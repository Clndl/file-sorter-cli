#!/usr/bin/env node

const
	fs = require('fs'),
	path = require('path'),
	ora = require('ora'),
	inquirer = require('inquirer'),
	ProgressBar = require('progress');

const getAllFiles = (dir, type, filesArray) => {
	filesArray = filesArray || [];

	const shouldSearch = type !== path.basename(dir);

	if (shouldSearch) {
		const files = fs.readdirSync(dir);

		files.forEach(file => {
			const abs = path.join(dir, file);

			if (fs.statSync(abs).isDirectory()) {
				filesArray = getAllFiles(abs, type, filesArray);
			} else {
				if (file !== '.DS_Store' && (!type || file.endsWith(type))) {
					filesArray.push(abs);
				}
			}
		});
	} else {
		// Push the directory itself if it matches
		filesArray.push(dir);
	}

	return filesArray;
};

const moveFileWithUniqueName = function(sourcePath, destinationPath) {
	let counter = 0;
	let newDestinationPath = destinationPath;

	while (fs.existsSync(newDestinationPath)) {
		counter++;
		const fileExtension = path.extname(destinationPath);
		const baseName = path.basename(destinationPath, fileExtension);
		newDestinationPath = path.join(path.dirname(destinationPath), `${baseName}_${counter}${fileExtension}`);
	}

	fs.renameSync(sourcePath, newDestinationPath, function(err){
		if(err) console.log(err)
	})
	console.log(`File "${sourcePath}" has been moved to "${newDestinationPath}".`);
}

const run = (src, dest, method, type) => {
	let scanner = ora('Scanning source directory and sub directories').start();
	let items = getAllFiles(src, type);
	scanner.succeed(`Found ${items.length} items`);

	if(items.length) {
		items.forEach(f => console.log(f))

		inquirer
			.prompt([{
				type: 'confirm',
				name: 'confirm',
				message: 'Do you want to continue?'
			}])
			.then(ans => {
				if (ans.confirm) {
					let progress = new ProgressBar(`  ${method.toUpperCase()} :current/:total files [:bar] :percent (:rate files/s, :etas remaing): :file`, {
						complete: '=',
						incomplete: ' ',
						width: 20,
						total: items.length
					});

					items.forEach(item => {
						let
							stat = fs.statSync(item),
							ext = path.extname(item),
							dirname = path.dirname(item),
							time = stat.birthtime,
							mod = new Date(time),
							year = mod.getFullYear(),
							month = ('0' + (mod.getMonth() + 1)).slice(-2),
							day = mod.getDate(),
							hours = mod.getUTCHours(),
							minutes = mod.getUTCMinutes(),
							tmp = `${dest}/${year}/${month}`,
							name = item.replace(/^.*[\\\/]/, '');


						if(method === 'rename' ){
							let newName = `${year}-${month}-${day}-${hours}-${minutes}${ext}`
							moveFileWithUniqueName(item, dirname + '/' + newName)
						}else if(method === 'remove'){
							fs.rm(item, { recursive: true, force: true }, (err) => {
								if(err) {
									console.error(`Error removing directory ${item}: ${err}`);
								}else {
									console.log(`Removed directory ${item}`);
								}
							});
						}else {
							if (!fs.existsSync(`${dest}/${year}`)) fs.mkdirSync(`${dest}/${year}`); // make year dir
							if (!fs.existsSync(tmp)) fs.mkdirSync(tmp); // make month dir

							if (method === 'copy') {
								fs.copyFileSync(item, tmp + '/' + name);
							}else if(method === 'move') {
								fs.renameSync(item, tmp + '/' + name, function(err,data){
									if(err) console.log(err)
								})
							}
						}
						progress.tick({
							file: item
						});
					})
				} else {
					process.exit();
				}
			})
	}else {
		process.exit();
	}
}

inquirer
	.prompt([{
			type: 'input',
			name: 'type',
			message: 'Wich type of file or directory do you want to find?'
		},{
			type: 'list',
			name: 'method',
			message: 'Which method do you want to use?',
			choices: [
				{
					name: 'Copy and sort files by date to new directory',
					value: 'copy',
				},
				{
					name: 'Move and sort files by date to new directory',
					value: 'move',
				},
				{
					name: 'Rename files by birthday',
					value: 'rename',
				},
				{
					name: 'Remove nested directory',
					value: 'remove',
				},
			]
		},
		{
			type: 'input',
			name: 'source',
			default: '.',
			message: 'Source directory path:',
			validate: val => fs.existsSync(val)
		},
		{
			type: 'input',
			name: 'dest',
			default: '.',
			message: 'Destination directory path:',
			validate: val => fs.existsSync(val)
		}
	])
	.then(res => {
		let {
			source,
			dest,
			method,
			type
		} = res;
		run(source, dest, method, type);
	})
	.catch(err => {
		if (err.isTtyError) {
			// Prompt couldn't be rendered in the current environment
			console.error('ERROR: Interactive interface couldn\'t be loaded, try using the basic method (single command with options).');
		} else {
			// Something else when wrong
			console.error('An error occured');
		}
		process.exit();
	})