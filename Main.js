var ScheduledTasks = require('./ScheduledTasks.js');
var CronJob = require('cron').CronJob;

var completedConsultationProcess = new CronJob(
	'*/1 * * * *', //Every 1min run function
	function() {
		ScheduledTasks.updateConsultEndTime();
	},
	null,
	true,
	'Asia/Singapore'
);

var consultationReminderProcess = new CronJob(
	'*/1 * * * *', //Every 1min run function
	function() {
		ScheduledTasks.consultationReminder();
	},
	null,
	true,
	'Asia/Singapore'
);


completedConsultationProcess.start();
consultationReminderProcess.start();
