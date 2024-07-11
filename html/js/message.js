function isGlobal(value) {
    let checkbox = document.getElementById('isglobal');
    if (checkbox.checked) {
        document.getElementById('neptuncode').disabled = true;
    } else {
        document.getElementById('neptuncode').disabled = false;
    }
}