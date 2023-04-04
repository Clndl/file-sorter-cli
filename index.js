#!/usr/bin/env node

const
	fs = require('fs'),
	path = require('path'),
	leeks = require('leeks.js'),
	ora = require('ora'),
	inquirer = require('inquirer'),
	argv = require('minimist')(process.argv.slice(2)),
	ProgressBar = require('progress'),
	c = leeks.colours;
let
	source = argv.source,
	dest = argv.dest,
	method = 'copy',
	type = null;
// strip colours if you or your computer sucks
const log = (str) => {
	if (leeks.supportsColour) {
		console.log(str);
	} else {
		console.log(str.replace(/\u001b\[.*?m/g, ''));
	}
}
const getAllFiles = (dir, filesArray, type) => {
	files = fs.readdirSync(dir);
	filesArray = filesArray || [];

	files.forEach(file => {
		if (fs.statSync(dir + "/" + file).isDirectory()) {
			filesArray = getAllFiles(dir + "/" + file, filesArray, type);
		} else {
			if(file != '.DS_Store') {
				let abs = path.join(dir, "/", file);
				if(type) {
					if(file.endsWith(type)) {
						filesArray.push(abs);
					}
				}else {
					filesArray.push(abs);
				}
			}
		}
	});

	return filesArray;
}

const run = (src, dest, method, type) => {
	let mc = method === 'copy' ? 0 : 1;
	let scanner = ora('Scanning source directory and sub directories for photos').start();
	let images = getAllFiles(src, null, type);
	scanner.succeed(`Found ${c.cyan(images.length)} files`);

	let progress = new ProgressBar(`  ${mc === 0 ? 'Copied' : 'Moved'} :current/:total files [:bar] :percent (:rate files/s, :etas remaing): :file`, {
		complete: '=',
		incomplete: ' ',
		width: 20,
		total: images.length
	});

	images.forEach(i => {
		let
			stat = fs.statSync(i),
			time = stat.birthtime,
			mod = new Date(time),
			year = mod.getFullYear(),
			month = ('0' + (mod.getMonth() + 1)).slice(-2),
			dir = `${dest}/${year}/${month}`,
			name = i.replace(/^.*[\\\/]/, '');

		if (!fs.existsSync(`${dest}/${year}`)) fs.mkdirSync(`${dest}/${year}`); // make year dir
		if (!fs.existsSync(dir)) fs.mkdirSync(dir); // make month dir

		if (mc === 0) {
			fs.copyFileSync(i, dir + '/' + name);
		} else {
			fs.renameSync(i, dir + '/' + name, function(err,data){
                if(err) console.log(err)
			})
		}
		progress.tick({
			file: name
		});
	})

	// log(`Preparing to sort and ${method.toUpperCase()} ${c.cyan(images.length)} files to ${c.blackBright(dest)}`)

}

if (argv.move) {
	method = 'move';
}

if (argv.type) {
	type = argv.type;
}

if (source || dest) {
	// non-interactive

	log(c.magentaBright('Command arguments supplied - skipping interactive interface,'));
	let fail = false;

	let sourceCheck = ora('Checking desintation');
	if (!source || !fs.existsSync(source)) {
		sourceCheck.fail(c.redBright('Source directory not specified or does not exist'));
		fail = true;
	} else {
		sourceCheck.succeed(c.greenBright('Source directory exists'));
	}
	let destCheck = ora('Checking desintation');
	if (!dest || !fs.existsSync(dest)) {
		destCheck.fail(c.redBright('Destination directory not specified or does not exist'))
		fail = true;
	} else {
		destCheck.succeed(c.greenBright('Destination directory exists'));
	}

	if (fail) {
		return log(c.redBright(`\n==============================\nFAILED: There were 1 or more issues. Perhaps you should use the interactive CLI?\n==============================\n`))
	}

	run(source, dest, method, type); // do it

} else {
	// interactive
	log(c.magentaBright('Entering interactive interface'));
	log(c.bgYellowBright(c.black('\nNOTICE: You won\'t be able to submit a source or destination path if the directory does not exist! Create the destination directory before starting.\n')))
	inquirer
		.prompt([{
				type: 'input',
				name: 'type',
				message: 'Wich type do you want to use?'
			},{
				type: 'list',
				name: 'method',
				message: 'Which method do you want to use?',
				choices: [{
						name: 'Copy to destination',
						value: 'copy',
					},
					{
						name: 'Move to destination',
						value: 'move',
					}
				]
			},
			{
				type: 'input',
				name: 'source',
				message: 'Source directory path:',
				validate: val => fs.existsSync(val)
			},
			{
				type: 'input',
				name: 'dest',
				message: 'Destination directory path:',
				validate: val => fs.existsSync(val)
			}
		])
		.then(res => {
			// source = res.source;
			// dest = res.dest;
			// method = res.method;
			let {
				source,
				dest,
				method,
				type
			} = res;
			log(`This will ${c.green(method.toUpperCase())} ${c.whiteBright('and sort images from')} ${c.blackBright(source)} ${c.whiteBright('to')} ${c.blackBright(dest)}`)
			inquirer
				.prompt([{
					type: 'confirm',
					name: 'confirm',
					message: 'Do you want to continue?'
				}])
				.then(ans => {
					if (ans.confirm) {
						run(source, dest, method, type);
					} else {
						process.exit();
					}
				})
		})
		.catch(err => {
			if (err.isTtyError) {
				// Prompt couldn't be rendered in the current environment
				log(c.redBright('ERROR: Interactive interface couldn\'t be loaded, try using the basic method (single command with options).'));
			} else {
				// Something else when wrong
				log(c.redBright('An error occured'))
			}
		})
}