dragElement(document.getElementById("infoContainer"));

function dragElement(elmnt) {
    var p1 = 0,
        p2 = 0,
        p3 = 0,
        p4 = 0;
    document.getElementById('DraggableTitleBar').onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e.preventDefault();
        p3 = e.clientX;
        p4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e.preventDefault();
        p1 = p3 - e.clientX;
        p2 = p4 - e.clientY;
        elmnt.style.top = (elmnt.offsetTop - (p4-e.clientY)) + "px";
        elmnt.style.left = (elmnt.offsetLeft - (p3-e.clientX)) + "px";
        p3 = e.clientX;
        p4 = e.clientY;
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

var coll = document.getElementsByClassName("collapsible");
for (var i = 0; i < coll.length; i++) {
    coll[i].addEventListener("click", function () {
        this.classList.toggle("active");
        var content = this.nextElementSibling;
        if (content.style.maxHeight) {
            content.style.maxHeight = null;
        } else {
            content.style.maxHeight = content.scrollHeight + "px";
        }
    });
}