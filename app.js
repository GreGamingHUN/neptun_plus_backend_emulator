const express = require("express");
const app = express();
const port = 3000;
const admin = require("firebase-admin");
const crypto = require("crypto");
const bodyParser = require('body-parser');

var serviceAccount = require("./admin-key.json");
const { type } = require("os");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

app.use(express.json());

app.post("/api/GetAddedSubjects", async (req, res) => {
  if (req.body.TermId == undefined) {
    return res.status(400).send("TermId is required");
  }
  db.collection("addedsubjects")
    .where("TermId", "==", parseInt(req.body.TermId)).where("neptunCode", "==", req.body.UserLogin.toUpperCase())
    .get()
    .then((snapshot) => {
      let content = [];
      snapshot.forEach((doc) => {
        content.push(doc.data());
      });
      res.send({ AddedSubjectsList: content });
    });
});

app.post("/api/SetReadedMessage", async (req, res) => {
  if (req.body.PersonMessageId == undefined) {
    return res.status(400).send("MessageId is required");
  }

  let messageId = req.body.PersonMessageId;
  let neptunCode = req.body.UserLogin.toUpperCase();

  db.collection("readmessages").add({
    "MessageID": messageId,
    "NeptunCode": neptunCode,
    "IsnNew": false
  }).then(() => {
    res.send({});
  });
});

function getDateFromString(dateString) {
  let timestamp = Number(dateString.match(/\d+/)[0]);
  return new Date(timestamp);
}

app.post("/api/GetCalendarData", async (req, res) => {
  if (req.body.startDate == undefined || req.body.endDate == undefined) {
    return res.status(400).send("startDate and endDate are required");
  }
  db.collection("calendar")
    .get()
    .then((snapshot) => {
      let content = [];
      snapshot.forEach((doc) => {
        let startDate = getDateFromString(req.body.startDate);
        let endDate = getDateFromString(req.body.endDate);
        endDate.setDate(endDate.getDate() + 1);
        if (
          getDateFromString(doc.get("start")) > startDate &&
          getDateFromString(doc.get("start")) < endDate
        ) {
          content.push(doc.data());
        }
      });
      res.send({ calendarData: content });
    });
});

app.post("/api/SetNewPassword", async (req, res) => {
  let newPassword = req.body.NewPassword;
  let hash = crypto.createHash("sha256").update(newPassword).digest("hex");

  db.collection("students")
    .where("neptunCode", "==", req.body.UserLogin.toUpperCase())
    .get()
    .then((snapshot) => {
      snapshot.forEach((doc) => {
        db.collection("students")
          .doc(doc.id)
          .update({
            password: hash,
          })
          .then(() => {
            res.send({});
          })
          .catch((error) => {
            console.log("Error updating student:", error);
          });
      });
    });
});

app.post("/api/SetExamSigning", async (req, res) => {
  let examID = req.body.ExamId;
  let neptunCode = req.body.UserLogin.toUpperCase();
  //let term = (await db.collection("periodterms").where("active", "==", true).get())[0];

  if (req.body.SigningOn == false) {
    let examQuery = await db.collection("addedexams").where("ExamID", "==", examID).where("NeptunCode", "==", neptunCode).get();
    let exam = examQuery.docs[0];
    if (exam != undefined) {
      if (exam.status == "pending") {
        await db.collection("addedexams").doc(exam.id).delete();
        res.send({});
        return;
      } else {
        res.send({ "ErrorMessage": "Leadás sikertelen, mert a vizsga már értékelve lett" });
        return;
      }
    }
    res.send({ "ErrorMessage": "Vizsgajelentkezés visszavonása sikertelen, mert nem jelentkezett erre a vizsgára" });
  }

  let exam = (await db.collection("addedexams").where("ExamID", "==", examID).where("NeptunCode", "==", neptunCode).get())[0];
  if (exam != undefined) {
    res.send({ "ErrorMessage": "Vizsgajelentkezés sikertelen, mert már jelentkezett erre a vizsgára" });
    return;
  }

  await db.collection("addedexams").add({
    "ExamID": examID,
    "NeptunCode": neptunCode,
    "grade": "",
    "status": "pending"
  });
  res.send({});
  return;
});

app.post("/api/GetSubjects", async (req, res) => {
  if (req.body.TermId == undefined) {
    return res.status(400).send("TermId is required");
  }
  db.collection("subjects")
    .where("TermID", "==", parseInt(req.body.TermId))
    .get()
    .then((snapshot) => {
      let content = [];
      snapshot.forEach((doc) => {
        content.push(doc.data());
      });
      res.send({ SubjectList: content });
    });
});

app.post("/api/Get*", async (req, res) => {
  let response = {};
  let collectionName = req.path.slice(8).toLowerCase();
  switch (collectionName) {
    case "exams":
      response.ExamList = await getExams(req.body.filter.ExamType, req.body.filter.Term, req.body.UserLogin.toUpperCase());

      res.send(response);
      return;
  }
  db.collection(collectionName)
    .get()
    .then(async (snapshot) => {
      let content = [];
      snapshot.forEach((doc) => {
        content.push(doc.data());
      });

      switch (collectionName) {
        case "messages":
          content = await filterMessages(content, req.body.UserLogin.toUpperCase());
          response.MessagesList = content;
          break;
        case "periodterms":
          response.PeriodTermsList = content;
          break;
        case "trainings":
          response.TrainingList = content;
          break;
        case "curriculums":
          response.CurriculumList = content;
          break;
        case "exams":
          response.ExamList = content;
        default:
          break;
      }

      res.send(response);
    });
});

async function getExams(added, termId, neptunCode) {
  if (added == 0) {
    let data = await db.collection("exams").where("TermID", "==", Number(termId)).get()
    let content = [];
    data.forEach(doc => {
      let exam = doc.data();
      exam.ExamID = doc.id;
      content.push(exam);
    });
    return content;
  } else if (added == 1) {
    let examCollection = await db.collection("addedexams").where("NeptunCode", "==", neptunCode).get();
    let examIds = [];
    examCollection.forEach(doc => {
      examIds.push(doc.data().ExamID);
    });
    let content = [];

    for (let i = 0; i < examIds.length; i++) {
      let exam = await db.collection("exams").doc(examIds[i]).get();
      if (exam.data().TermID == termId) {
        exam = exam.data();
        exam.ExamID = examIds[i];
        exam.status = examCollection.docs[i].data().status;
        content.push(exam);

      }
    }
    return content;
  }
}

async function filterMessages(content, neptunCode) {
  let filteredContent = [];
  let readMessages = await db.collection("readmessages").where("NeptunCode", "==", neptunCode).get();
  content.forEach((message) => {
    if (message.IsGlobal == true || message.RecipientNeptunCode == neptunCode) {
      message.IsNew = true;
      readMessages.forEach((readMessage) => {
        if (readMessage.data().MessageID == message.Id) {
          message.IsNew = false;
        }
      });
      filteredContent.push(message);
    }
  });
  return filteredContent;
}

app.post("/api/register", async (req, res) => {
  let body = req.body;
  if (!body.neptunCode) {
    return res.status(400).send("neptunCode is required");
  }
  if (!body.password) {
    return res.status(400).send("password is required");
  }
});

app.use(express.static(__dirname + '/html'));

app.use(bodyParser.urlencoded({ extended: true }));

app.engine('html', require('ejs').renderFile);

app.get("/", (req, res) => {
  return res.render(__dirname + "/html/index.ejs");
});

app.post("/login", (req, res) => {

  if (req.body.username == 'admin' && req.body.password == 'admin') {
    return res.redirect('/admin');
  }
  console.log("hibás jelszó");
  return res.redirect('/');
});

app.get("/admin", (req, res) => {
  db.collection("students").get().then((snapshot) => {
    let content = [];
    snapshot.forEach((doc) => {
      content.push(doc.data().neptunCode);
    });
    console.log(content);
    return res.render(__dirname + "/html/admin.ejs", { students: content });
  });
});

app.post("/admin/addStudent", (req, res) => {
  let hash = crypto.createHash("sha256").update(req.body.password).digest("hex");
  db.collection("students").add({
    neptunCode: req.body.neptunCode.toUpperCase(),
    password: hash
  }).then(() => {
    console.log("letsgo");
    return res.redirect('/admin');
  });
})

app.get("/admin/subjects", async (req, res) => {
  let periodTerms = await db.collection("periodterms").get();
  periodTerms = periodTerms.docs.map(doc => doc.data());
  let subjects;
  if (req.query.periodtermid != undefined) {
    subjects = await db.collection("subjects").where("TermID", "==", Number(req.query.periodtermid)).get();
    subjects = subjects.docs.map(doc => doc.data());
  }
  if (req.query.periodtermid == '') {
    subjects = undefined;
  }
  return res.render(__dirname + "/html/subjects.ejs", {periodTerms: periodTerms, subjects: subjects, periodTermId: req.query.periodtermid});
});

app.get("/admin/newsubject", async (req, res) => {
  let periodTerms = await db.collection("periodterms").get();
  periodTerms = periodTerms.docs.map(doc => doc.data());
  
  return res.render(__dirname + "/html/newsubject.ejs", {periodTerms: periodTerms, periodTermId: req.query.periodtermid});
});

app.post("/admin/newSubject", async (req, res) => {
  let subjectCode = req.body.subjectcode;
  let subjectName = req.body.subjectname;
  let type = req.body.type;
  let requirement = req.body.requirement;
  let credit = req.body.credit;
  let subjectSearch = await db.collection("subjects").where("SubjectCode", "==", subjectCode).get();
  if (subjectSearch.empty) {
    db.collection("subjects").add({
      SubjectCode: subjectCode,
      SubjectName: subjectName,
      SubjectSignupType: type,
      SubjectRequirement: requirement,
      Credit: Number(credit),
      CurriculumTemplateID: 69420,
      CurriculumTemplatelineID: 123,
      SubjectId: getRandomNumber(100000, 999999),
      TermID: Number(req.body.periodterm)
    }).then(() => {
      return res.redirect('/admin/subjects');
    });
  } else {
    return res.redirect('/admin/newsubject');
  }
});

app.get("/admin/courses", async(req, res) => {
  let subjectName = (await db.collection("subjects").where("SubjectCode", "==", req.query.subjectid).get()).docs[0].data().SubjectName;
  let courses = await db.collection("courses").where("SubjectCode", "==", req.query.subjectid).get();
  courses = courses.docs.map(doc => doc.data());
  return res.render(__dirname + "/html/courses.ejs", {courses: courses, subjectName: subjectName, subjectId: req.query.subjectid});
});

app.get("/admin/newcourse", async (req, res) => {
  let subjectCode = req.query.subjectid;
  return res.render(__dirname + "/html/newcourse.ejs", {subjectCode: subjectCode});
});

app.post("/admin/newCourse", async (req, res) => {
  let courseCode = req.body.coursecode;
  let subjectCode = req.body.subjectcode;
  let info = req.body.info;
  let limit = req.body.limit;
  let courseType = req.body.type;
  let courseTutor = req.body.tutor;
  let courseSearch = await db.collection("courses").where("CourseCode", "==", courseCode).get();
  if (courseSearch.empty) {
    db.collection("courses").add({
      CourseCode: courseCode,
      SubjectCode: subjectCode,
      CourseTimeTableInfo: info,
      StudentLimit: Number(limit),
      SignedStudents: 0,
      CourseType_DNAME: courseType,
      CourseTutor: courseTutor,
      Id: getRandomNumber(100000, 999999)
    }).then(() => {
      return res.redirect('/admin/courses?subjectid=' + req.body.subjectcode);
    });
  } else {
    return res.redirect('/admin/newcourse');
  }
});

app.get("/admin/exams", async (req, res) => {
  let subjectCode = req.query.subjectid;
  let exams = await db.collection("exams").where("SubjectCode", "==", subjectCode).get();
  exams = exams.docs.map(doc => doc.data());
  return res.render(__dirname + "/html/exams.ejs", {exams: exams, subjectCode: subjectCode});
});

app.get("/admin/newexam", async (req, res) => {
  let subjectCode = req.query.subjectid;
  return res.render(__dirname + "/html/newexam.ejs", {subjectCode: subjectCode});
});

app.post("/admin/newExam", async (req, res) => {
  let fromDate = new Date(req.body.fromdate).getTime();
  let toDate = new Date(req.body.todate).getTime();
  let subjectCode = req.body.subjectcode
  let type = req.body.type;
  let subject = await db.collection("subjects").where("SubjectCode", "==", subjectCode).get();
  let subjectName = subject.docs[0].data().SubjectName;
  let termID = subject.docs[0].data().TermID;

  db.collection("exams").add({
    FromDate: `/Date(${fromDate})/`,
    ToDate: `/Date(${toDate})/`,
    SubjectCode: subjectCode,
    ExamType: type,
    SubjectName: subjectName,
    TermID: termID
  }).then(() => {
    return res.redirect('/admin/exams?subjectid=' + subjectCode);
  });
});

app.get("/admin/message", async (req, res) => {
  let students = await db.collection("students").get();
  let neptunCodes = students.docs.map(doc => doc.data().neptunCode);
  return res.render(__dirname + "/html/message.ejs", { neptunCodes: neptunCodes });
});

app.post("/admin/sendMessage", async (req, res) => {
  let sendDateMilliseconds = new Date().getTime();
  let randomNumber;
  let unique = false;

  //duplicate id check
  while (!unique) {
    randomNumber = getRandomNumber(100000, 999999);
    let snapshot = await db.collection("messages").where("Id", "==", randomNumber).get();
    if (snapshot.empty) {
      unique = true
    }
  }

  db.collection("messages").add({
    Subject: req.body.subject,
    Detail: req.body.details,
    IsGlobal: req.body.isglobal == "on" ? true : false,
    RecipientNeptunCode: req.body.neptuncode ?? "",
    Name: "Rendszerüzenet",
    SendDate: `/Date(${sendDateMilliseconds})/`,
    Id: randomNumber
  }).then(() => {
    return res.redirect('/admin');
  });
})

function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}


app.listen(3000, () => {
  console.log(`Server is running on port ${port}`);
});


function getHash(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}