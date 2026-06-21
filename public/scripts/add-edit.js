function updateRating(n) {
	const stars = document.getElementsByClassName("star");

	for (let i = 0; i < stars.length; i++) {
		const star = stars[i];
		if (!star) {
			continue;
		}

		if (i < n) {
			star.classList.add("filled");
			continue;
		}
		star.classList.remove("filled");
	}

	const output = document.getElementById("output");
	if (output) {
		output.innerText = n.toString();
	}
}
