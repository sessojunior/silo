/* SIDEBAR MENU - HIDE/SHOW */
const showHideMenu = document.getElementById("show-hide-menu");
showHideMenu?.addEventListener("click", () => {
	const boxLabel = document.getElementsByClassName("box-label");
	const sidebar = document.getElementById("sidebar");
	const container = document.getElementById("container");
	const footer = document.getElementById("footer");
	for (let element of Array.from(boxLabel)) {
		element.style.display =
			element.style.display === "none" ? "flex" : "none";
	}
	sidebar.style.width =
		sidebar.style.width === "var(--width-sidebar-mini)"
			? "var(--width-sidebar)"
			: "var(--width-sidebar-mini)";
	container.style.width =
		container.style.width === "calc(100% - var(--width-sidebar-mini))"
			? "calc(100% - var(--width-sidebar))"
			: "calc(100% - var(--width-sidebar-mini))";
	footer.style.width =
		footer.style.width === "calc(100% - var(--width-sidebar-mini))"
			? "calc(100% - var(--width-sidebar))"
			: "calc(100% - var(--width-sidebar-mini))";
	showHideMenu.classList.toggle("active");
});

/* OFFCANVAS OPEN */
/* TODO: NECESSÁRIO USAR AJAX PARA CARREGAR DINAMICAMENTE OU REACT */
openOffCanvas = document.getElementsByClassName("open-offcanvas");
for (i = 0; i < openOffCanvas.length; i++) {
	openOffCanvas[i]?.addEventListener("click", (event) => {
		id = event.currentTarget.getAttribute("data-id");
		document
			.getElementById(`offcanvas-${id}`)
			.getElementsByClassName("overlay")[0].style.display = "block";
		document
			.getElementById(`offcanvas-${id}`)
			.getElementsByClassName("content")[0]
			.classList.toggle("active");
	});
}

/* OFFCANVAS CLOSE */
closeOffCanvas = document.getElementsByClassName("close-offcanvas");
for (i = 0; i < closeOffCanvas.length; i++) {
	closeOffCanvas[i]?.addEventListener("click", (event) => {
		id = event.currentTarget.getAttribute("data-id");
		document
			.getElementById(`offcanvas-${id}`)
			.getElementsByClassName("overlay")[0].style.display = "none";
		document
			.getElementById(`offcanvas-${id}`)
			.getElementsByClassName("content")[0]
			.classList.toggle("active");
	});
}
/* ON CLICK IN OVERLAY CLOSE THE OFFCANVAS */
overlay = document.getElementsByClassName("overlay");
for (i = 0; i < overlay.length; i++) {
	overlay[i]?.addEventListener("click", (event) => {
		id = event.target.parentNode.id;
		document
			.getElementById(id)
			.getElementsByClassName("overlay")[0].style.display = "none";
		document
			.getElementById(id)
			.getElementsByClassName("content")[0]
			.classList.toggle("active");
	});
}
