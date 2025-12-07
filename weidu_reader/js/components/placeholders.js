
export const placehlderUrls = [
	"https://doodleipsum.com/700/abstract?i=1d1834d99bc4a0d3e6500b1d993a45f4",
	"https://doodleipsum.com/700/abstract?i=2950d197771be2105d7d9a91975907bc",
	"https://doodleipsum.com/700/abstract?i=2e12c586a431bea0edc62934cd35b054",
	"https://doodleipsum.com/700/abstract?i=328d9f65b629fc31231f79aa93af56f9",
	"https://doodleipsum.com/700/abstract?i=9e88b00d558613df9b31e2d3782244c3",
	"https://doodleipsum.com/700/abstract?i=aa232430a10425614dea28ed18c11a9e",
	"https://doodleipsum.com/700/abstract?i=c194787e015a971b4da76eccefb9bfa7",
	"https://doodleipsum.com/700/abstract?i=ebd26ddc6f49aa56a7bf54dfd408374a",
	"https://doodleipsum.com/700/abstract?i=f8b1abea359b643310916a38aa0b0562",
	"https://doodleipsum.com/700/flat?i=4fd6e41d0d4782e287ad04e8174a1ebd",
	"https://doodleipsum.com/700/flat?i=934094fdf9650619886d1f1d9e713132",
	"https://doodleipsum.com/700/flat?i=d9e22222279c1e46487c4dc95a43baa3",
	"https://doodleipsum.com/700/outline?i=55aa69c1a283b92cf3c87e6a3a598eaf",
	"https://doodleipsum.com/700/outline?i=9e4b919155f89f2ce88d0aa8a9e6a343",
	"https://doodleipsum.com/700/abstract?i=3c3a259ced051ff05ebf18363560f8a3",
];

export const placeholderColors = [
	"#D98D63",
	"#63C8D9",
	"#825DEB",
	"#FF3C3C",
	"#D96363",
	"#3D27F6",
	"#76db7a",
];

// getPlaceholderImg gives a determnistic image based on the input string
function getPlaceholderImg(inputStr) {
	const urlIndex = Math.abs(hashString(inputStr)) % placehlderUrls.length;
	return placehlderUrls[urlIndex];
}

// getPlaceholderColor gives a determnistic color based on the input string
export function getPlaceholderColor(inputStr) {
	const colorIndex = Math.abs(hashString(inputStr)) % placeholderColors.length;
	return placeholderColors[colorIndex];
}
