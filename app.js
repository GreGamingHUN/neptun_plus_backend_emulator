const express = require("express");
const app = express();
const port = 3000;
const admin = require("firebase-admin");
const crypto = require("crypto");

var serviceAccount = require("./admin-key.json");

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
  db.collection("messages")
    .where("Id", "==", messageId)
    .get()
    .then((snapshot) => {
      if (!snapshot.empty) {
        snapshot.forEach((doc) => {
          db.collection("messages")
            .doc(doc.id)
            .update({
              IsNew: false,
            })
            .then(() => {
              res.send({});
            })
            .catch((error) => {
              console.log("Error updating message:", error);
              res.status(500).send("Error updating message: " + error);
            });
        });
      } else {
        res.status(404).send("No message found with the provided ID");
      }
    })
    .catch((error) => {
      console.log("Error getting message:", error);
      res.status(500).send("Error getting message: " + error);
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
  let collectionName = req.path.slice(4).toLowerCase();
  db.collection(collectionName)
    .get()
    .then((snapshot) => {
      let content = [];
      snapshot.forEach((doc) => {
        content.push(doc.data());
      });

      switch (collectionName) {
        case "messages":
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
        default:
          break;
      }

      res.send(response);
    });
});

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


app.get("/", (req, res) => {
  return res.sendFile(__dirname + "/html/index.html");
});

app.listen(3000, () => {
  console.log(`Server is running on port ${port}`);
});
