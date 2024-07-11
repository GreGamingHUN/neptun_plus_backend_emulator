function setPeriodTerm(value) {
    window.location.href = "/admin/subjects?periodtermid=" + value;
}

function newSubject(periodTermId) {
    window.location.href = "/admin/newsubject?periodtermid=" + periodTermId;
}

function showCourses(subjectId) {
    window.location.href = "/admin/courses?subjectid=" + subjectId;
}

function showExams(subjectId) {
    window.location.href = "/admin/exams?subjectid=" + subjectId;
}