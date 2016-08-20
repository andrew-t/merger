var split = require('./split'),
	program = require('commander'),
	fs = require('fs');

program
  .version('0.0.1')
  .option('-p, --packagejson', 'Merge package.json automatically')
  .option('-q, --quiver', 'Merge a Quiver note automatically')
  // TODO: .option('-d, --directory', 'The directory to look in')
  .parse(process.argv);

if (program.packagejson) {
	var versions = splitJson('package.json'),
		dependencies = popProp(versions, 'dependencies'),
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

if (program.quiver) {
	// meta.json
	var versions = splitJson('meta.json'),
		merged = applyMergers(versions, {
			created_at: Math.min,
			tags: union,
			title: separateWith('/'),
			updated_at: Math.max,
			uuid: expectMatch
		});
	fs.writeFileSync('meta.json',
		JSON.stringify(merged, null, 2));

	// content.json
	versions = splitJson('content.json');
	merged = {
		title: merged.title,
		cells: []
	};
	var inBoth = intersection.apply(this,
		versions.map(function(v) {
			return v.cells.map(function(c) {
				return c.data;
			});
		})),
		seenInBoth = {},
		i = [ 0, 0 ],
		current = 0;
	while (true) {
		if (i[0] >= versions[0].cells.length &&
			i[1] >= versions[1].cells.length)
			break;
		var currentCell = versions[current].cells[i[current]++];
		if (!currentCell) {
			current =+! current;
			continue;
		}
		var currentData = currentCell.data;
		if (inBoth.indexOf(currentData) >= 0) {
			// This cell is not conflicted (as far as we care)
			if (seenInBoth[currentData])
				// We've skipped this cell once; it is time to bring it in.
				merged.cells.push(currentCell);
			else {
				// This cell is in both and this is the first time we've seen it. Switch to the other version and we'll pull it in from there when we hit it.
				seenInBoth[currentData] = true;
				current =+! current;
			}
		} else
			merged.cells.push(currentCell);
	}
	fs.writeFileSync('content.json',
		JSON.stringify(merged, null, 2));
}

function splitJson(fn) {
	return split(fs.readFileSync(fn).toString())
			.map(function (json) { return JSON.parse(json); });
}

function applyMergers(versions, mergers) {
	var merged = {};
	for (var key in mergers)
		merged[key] = mergers[key](
			versions[0][key], versions[1][key]);
	return merged;
}

function separateWith(separator) {
	return function(a, b) {
		if (a == b)
			return a;
		return a + separator + b;
	}
}

function union(a, b) {
	var merged = {};
	a.forEach(function(k) {
		merged[k] = true;
	});
	b.forEach(function(k) {
		merged[k] = true;
	});
	return Object.keys(merged);
}

function intersection(a, b) {
	var merged = {};
	a.forEach(function(k) {
		if (b.indexOf(k) >= 0)
			merged[k] = true;
	});
	return Object.keys(merged);
}

function expectMatch(a, b) {
	mustEqual(a, b);
	return a;
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