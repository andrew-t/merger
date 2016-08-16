module.exports = function(data) {
	var lines = data.split('\n'),
		a = [],
		b = [],
		current = 3;
	lines.forEach(function(line) {
		if (line.trim() == '<<<<<<< HEAD')
			current = 1;
		else if (line.trim() == '=======')
			current = 2;
		else if (line.substr(0, 8) == '>>>>>>> ')
			current = 3;
		else {
			if (current & 1) a.push(line);
			if (current & 2) b.push(line);
		}
	});
	return [a, b].map(function(a) { return a.join('\n'); });
};