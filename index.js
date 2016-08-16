var split = require('./split'),
	program = require('commander'),
	fs = require('fs');

program
  .version('0.0.1')
  .option('-p, --packagejson', 'Merge package.json automatically')
  .parse(process.argv);

if (program.packagejson) {
	var versions = split(fs.readFileSync('package.json').toString())
			.map(function (json) { return JSON.parse(json); });
	var dependencies = popProp(versions, 'dependencies'),
		devDependencies = popProp(versions, 'devDependencies');
	mustEqual(versions[0], versions[1]);
	var base = versions[0];
	base.dependencies = {};
	allKeys(dependencies).forEach(function(key) {
		if (!dependencies[0][key])
			base.dependencies[key] = dependencies[1][key];
		else if (!dependencies[1][key])
			base.dependencies[key] = dependencies[0][key];
		else base.dependencies[key] = getBestVersion(dependencies[0][key], dependencies[1][key]);
	});
	base.devDependencies = {};
	allKeys(devDependencies).forEach(function(key) {
		if (base.dependencies[key])
			return;
		if (!devDependencies[0][key])
			base.devDependencies[key] = devDependencies[1][key];
		else if (!devDependencies[1][key])
			base.devDependencies[key] = devDependencies[0][key];
		else base.devDependencies[key] = getBestVersion(devDependencies[0][key], devDependencies[1][key]);
	});
	fs.writeFileSync('package.json', JSON.stringify(base, null, 2));
}

function getBestVersion(a, b) {
	var vnum = /^\^?(\d+\.)*\d+$/;
	if (!vnum.test(a) || !vnum.test(b)) {
		if (a == b) return a;
		else throw new Error('Can’t judge ' + a + ' vs ' + b);
	}
	var aCaret = a[0] == '^',
		bCaret = b[0] == '^',
		aVersion = getVersionNumber(a, aCaret),
		bVersion = getVersionNumber(b, bCaret),
		best = bestVersionNumber(aVersion, bVersion);
	return ((aCaret && bCaret) ? '^' : '') + best.join('.');
}
function getVersionNumber(v, caret) {
	if (caret) v = v.substr(1);
	return v.split('.').map(function(s) {
		return parseInt(s, 10);
	});
}
function bestVersionNumber(a, b) {
	var l = Math.max(a.length, b.length);
	for (var i = 0; i < l; ++i)
		if (a[i] > b[i])
			return a;
		else if (b[i] > a[i])
			return b;
	return a;
}

function popProp(arr, prop) {
	return arr.map(function(val) {
		var p = val[prop];
		delete val[prop];
		return p;
	});
}

function allKeys(arr) {
	var keys = [];
	arr.forEach(function(obj) {
		Object.keys(obj).forEach(function(key) {
			if (keys.indexOf(key) < 0)
				keys.push(key);
		});
	});
	return keys;
}

function mustEqual(a, b) {
	if (typeof a !== typeof b)
		throw new Error('Type mismatch: ' + (typeof a) + ' ≠ ' + (typeof b));
	if (a instanceof Array) {
		if (a.length !== b.length)
			throw new Error('Length mismatch: ' + a.length + ' ≠ ' + b.length);
		for (var i = 0; i < a.length; ++i)
			mustEqual(a[i], b[i]);
	} else if (typeof a === 'object') {
		for (var key in a)
			mustEqual(a[key], b[key]);
		for (var key in b)
			if (!a.hasOwnProperty(key))
				throw new Error('Missing key: ' + key);
	} else if (a !== b)
		throw new Error('Value mismatch: ' + a + ' ≠ ' + b);
}