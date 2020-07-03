var ScheduledTasks = require('./ScheduledTasks.js');
var CronJob = require('cron').CronJob;

var task = new CronJob(
	'*/1 * * * *', //Every min run function
	function() {
		ScheduledTasks.updateConsultEndTime();
	},
	null,
	true,
	'Asia/Singapore'
);

task.start();
