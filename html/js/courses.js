function newCourse(subjectId) {
    window.location.href = "/admin/newcourse?subjectid=" + subjectId;
}

function students(courseCode) {
    window.location.href = "/admin/students?coursecode=" + courseCode;
}