const packages = [
	'./',
	'./node_modules/island/',
	'./node_modules/island-keeper/'
];

packages.forEach(d => {
	try {
		const p = require(d + 'package.json');
		console.log(`version ${p.name} : ${p.version}`);
	} catch (e) {
	}
});

const versions = process.versions;
console.log(`version v8   : ${versions.v8}`);
console.log(`version node : ${versions.node}`);
