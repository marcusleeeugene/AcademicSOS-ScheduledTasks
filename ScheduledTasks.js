var firebase = require('firebase');
var database = require("./FireBaseConfig.js");
var moment = require("moment");

/*
===============================
COMPLETEDCONSULTATIONPROCESS
===============================
*/
function deductPoints(userIndex, participants, modCode, bookingId) {
  var userId = participants[userIndex].id;
  database
    .ref(`users/students/${userId}/modules/${modCode}`)
    .once("value")
    .then((snapshot) => snapshot.val())
    .then((data) => {
      database.ref(`users/students/${userId}/modules`).child(modCode).update({ //deduct priority points
        name: data.name,
        priorityPoint: data.priorityPoint -= 10,
        role: data.role,
        tutorialClass: data.tutorialClass
      });
      console.log("Deducted 10 points from: " + userId);
    })
}

function completeConsultation(modCode, bookingId, consultDetails) {
  var participants = consultDetails['participants'];
  if (participants != " ") { //If participants exist
    for (var user in participants) {
      if (participants[user]['attending'] == false) { //each participant that did not attend the consultation
        deductPoints(user, participants, modCode, bookingId);
      }
    }
  }
  database.ref(`modules/${modCode}/bookings`).child(bookingId).remove(); //delete consultation from bookings
  console.log("Removed: " + bookingId);
}

/*
===============================
CONSULTATIONREMINDERPROCESS
===============================
*/
function role(id) {
  //Checks which role branch user belongs to (Student / Professor)
  var userRole;
  if (id.charAt(0) == "e" || id.charAt(0) == "E") {
    userRole = "students";
  } else {
    userRole = "professors";
  }
  return userRole;
};

function notifyUserConsultation(modCode, bookingId, consultDetails) {
  var participants = consultDetails["participants"];
  for (var each in participants) {
    var user = participants[each];
    if (user.altStatus == "Accepted") { //If user has accepted consultation already
      console.log(user);
      sendOutNotification(user.id, modCode, bookingId, consultDetails);
    }
  }
}

function sendOutNotification(userId, modCode, bookingId, consultDetails) {
  database
    .ref(`users/${role(userId)}/${userId}`)
    .once("value")
    .then((snapshot) => snapshot.val())
    .then((data) => {
      console.log(`Pushed out notification for ${userId}`);
      sendReminderPushNotification(data.pushToken, modCode, bookingId, consultDetails); //Send notification to user
    });
}

async function sendReminderPushNotification(expoPushToken, modCode, bookingId, consultDetails) {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title: `Upcoming Consultation for ${modCode}:`,
    body: `TA: ${consultDetails["ta"].name}\nDate: ${consultDetails["consultDate"]} | Time: ${consultDetails["consultStartTime"]}\nLocation: ${consultDetails["location"]}`,
    data: {bookingId: bookingId},
  };

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });
}

module.exports = {
  updateConsultEndTime: function () {
    console.log("completedConsultationProcess - DateTime:" + moment(new Date(), ["DD-MMM-YY hh:mm A"]).format());
    database
      .ref(`modules`)
      .once("value")
      .then((snapshot) => snapshot.val())
      .then((obj) => {
        for (var modCode in obj) { //Loop each module
          //Loop through each module
          var modules = obj[modCode];
          var bookings = modules["bookings"];
          if (bookings != undefined) {
            for (var userBookings in bookings) { //Loop each booking
              var individualBookings = bookings[userBookings];
              var consultStatus = individualBookings["consultStatus"];
              var bookingId = Object.keys(bookings)[0];
              var consultDate = individualBookings["consultDate"];
              var consultEndTime = individualBookings["consultEndTime"];
              var currentDateTime = moment(new Date(), ["DD-MMM-YY hh:mm A"]).format();
              var consultationEndDateTime = moment(consultDate + " " + consultEndTime, ["DD-MMM-YY hh:mm A"]).format();
              if (consultStatus != "Pending") { //If consultation is confirmed
                if (currentDateTime >= consultationEndDateTime) { //check if consultation date and time ended
                  completeConsultation(modCode, bookingId, bookings[bookingId]);
                }
              } else { //Consultation is pending
                if (currentDateTime >= consultationEndDateTime) { //check if consultation date and time ended
                  database.ref(`modules/${modCode}/bookings`).child(bookingId).remove(); //delete consultation from bookings
                  console.log("Removed: " + bookingId);
                }
              }
            }
          }
        }
      })
  },
  consultationReminder: function() {
    console.log("consultationReminderProcess - DateTime:" + moment(new Date(), ["DD-MMM-YY hh:mm A"]).format());
    database
      .ref(`modules`)
      .once("value")
      .then((snapshot) => snapshot.val())
      .then((obj) => {
        for (var modCode in obj) { //Loop each module
          //Loop through each module
          var modules = obj[modCode];
          var bookings = modules["bookings"];
          if (bookings != undefined) {
            for (var userBookings in bookings) { //Loop each booking
              var individualBookings = bookings[userBookings];
              var consultStatus = individualBookings["consultStatus"];
              var bookingId = Object.keys(bookings)[0];
              var consultDate = individualBookings["consultDate"];
              var consultStartTime = individualBookings["consultStartTime"];
              var currentDateTime = moment(moment(new Date(), ["DD-MMM-YY hh:mm A"]).format());
              var consultationStartDateTime = moment(moment(consultDate + " " + consultStartTime, ["DD-MMM-YY hh:mm A"]).format());
              if (consultStatus != "Pending") { //If consultation is confirmed
                if (currentDateTime.diff(consultationStartDateTime, 'minutes') == -(24 * 60)) { //check if current time is 24 hours before consultation start time
                  notifyUserConsultation(modCode, bookingId, bookings[bookingId]); //now to loop through each participant and check altstatus accepted then send push notifications
                }
              }
            }
          }
        }
      });
  }
};
