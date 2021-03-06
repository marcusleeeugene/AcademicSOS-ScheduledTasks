var firebase = require('firebase');
var database = require("./FireBaseConfig.js");
var moment = require("moment");
moment.suppressDeprecationWarnings = true;

/*
==============================
COMPLETED CONSULTATION
==============================
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
      return data.priorityPoint -= 10;
    }).then((updatedPriorityPoints) => {
      if (updatedPriorityPoints <= 0) { //permanently ban user if points 0 or less
        setPermanentBan(userId, modCode);
      } else if (updatedPriorityPoints <= 30) { //ban user from booking if points 30 or less
        setBanReleaseDate(userId, modCode);
      }
    });
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
==============================
CONSULTATION REMINDER
==============================
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

function notifyUserConsultation(modCode, consultDetails) {
  var participants = consultDetails["participants"];
  for (var each in participants) {
    var user = participants[each];
    if (user.altStatus == "Accepted") { //If user has accepted consultation already
      database
        .ref(`users/${role(user.id)}/${user.id}`)
        .once("value")
        .then((snapshot) => snapshot.val())
        .then((data) => {
          sendReminderPushNotification(data.pushToken, modCode, consultDetails); //Send notification to user
        });
    }
  }
}

async function sendReminderPushNotification(expoPushToken, modCode, consultDetails) {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title: `Upcoming Consultation for ${modCode}:`,
    body: `TA: ${consultDetails["ta"].name}\nDate: ${consultDetails["consultDate"]} | Time: ${consultDetails["consultStartTime"]}\nLocation: ${consultDetails["location"]}`,
    data: {},
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

/*
==============================
BAN DATE
==============================
*/
function resetBanDate(userId, modCode) {
  database
    .ref(`users/students/${userId}/modules/${modCode}`)
    .once("value")
    .then((snapshot) => snapshot.val())
    .then((data) => {
      database.ref(`users/students/${userId}/modules`).child(modCode).update({ //reset banDateRelease
        name: data.name,
        priorityPoint: data.priorityPoint,
        role: data.role,
        tutorialClass: data.tutorialClass,
        banDateRelease: " "
      });
      console.log(`Resetted banDateRelease for ${modCode}:  ${userId}`);
    })
}

function setBanReleaseDate(userId, modCode) {
  var banDateRelease = moment(new Date()).add(7, 'days').format("DD-MMM-YY");
  database
    .ref(`users/students/${userId}/modules/${modCode}`)
    .once("value")
    .then((snapshot) => snapshot.val())
    .then((data) => {
      database.ref(`users/students/${userId}/modules`).child(modCode).update({ //set banDateRelease
        name: data.name,
        priorityPoint: data.priorityPoint,
        role: data.role,
        tutorialClass: data.tutorialClass,
        banDateRelease: banDateRelease
      });
      console.log(`Set new banDateRelease for ${modCode}:  ${userId}`);
    })
}

function setPermanentBan(userId, modCode) {
  database
    .ref(`users/students/${userId}/modules/${modCode}`)
    .once("value")
    .then((snapshot) => snapshot.val())
    .then((data) => {
      database.ref(`users/students/${userId}/modules`).child(modCode).update({ //set banDateRelease
        name: data.name,
        priorityPoint: data.priorityPoint,
        role: data.role,
        tutorialClass: data.tutorialClass,
        banDateRelease: "permanent"
      });
      console.log(`Set permanent ban for ${modCode}:  ${userId}`);
    })
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
            var index = 0;
            for (var userBookings in bookings) { //Loop each booking
              var individualBookings = bookings[userBookings];
              var consultStatus = individualBookings["consultStatus"];
              var bookingId = Object.keys(bookings)[index];
              index++;
              var consultDate = individualBookings["consultDate"];
              var consultEndTime = individualBookings["consultEndTime"];
              var currentDateTime = moment(moment(new Date(), ["DD-MMM-YY hh:mm A"]).format());
              var consultationEndDateTime = moment(moment(consultDate + " " + consultEndTime, ["DD-MMM-YY hh:mm A"]).format());
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
            var index = 0;
            for (var userBookings in bookings) { //Loop each booking
              var individualBookings = bookings[userBookings];
              var consultStatus = individualBookings["consultStatus"];
              var bookingId = Object.keys(bookings)[index];
              index++;
              var consultDate = individualBookings["consultDate"];
              var consultStartTime = individualBookings["consultStartTime"];
              var currentDateTime = moment(moment(new Date(), ["DD-MMM-YY hh:mm A"]).format());
              var consultationStartDateTime = moment(moment(consultDate + " " + consultStartTime, ["DD-MMM-YY hh:mm A"]).format());
              if (consultStatus != "Pending") { //If consultation is confirmed
                if (currentDateTime.diff(consultationStartDateTime, 'minutes') == -(24 * 60)) { //check if current time is 24 hours before consultation start time
                  notifyUserConsultation(modCode, bookings[bookingId]); //now to loop through each participant and check altstatus accepted then send push notifications
                }
              }
            }
          }
        }
      });
  },
  releaseBanDate: function() {
    console.log("releaseBanDateProcess - DateTime:" + moment(new Date(), ["DD-MMM-YY hh:mm A"]).format());
    database
      .ref(`users/students`)
      .once("value")
      .then((snapshot) => snapshot.val())
      .then((obj) => {
        var currentDateTime = moment(moment(new Date(), ["DD-MMM-YY hh:mm A"]).format());
        for (var student in obj) { //Loop each student
          for (var modCode in obj[student]["modules"]) {
            if (obj[student]["modules"][modCode].banDateRelease.length > 0 && obj[student]["modules"][modCode].banDateRelease != "permanent") {
              var banDateRelease = moment(moment(obj[student]["modules"][modCode].banDateRelease, ["DD-MMM-YY hh:mm A"]).format());
              if (currentDateTime.diff(banDateRelease, 'days') == 0) {
                resetBanDate(student, modCode);
              }
            }
          }
        }
      });
  }
};
