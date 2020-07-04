var firebase = require('firebase');
var database = require("./FireBaseConfig.js");
var moment = require("moment");

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

module.exports = {
  updateConsultEndTime: function () {
    console.log("Thread is running... DateTime:" + moment(new Date(), ["DD-MMM-YY hh:mm A"]).format());
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
              if (consultStatus != "Pending") { //If consultation is completed
                //Loop through each booking
                var bookingId = Object.keys(bookings)[0];
                var consultDate = individualBookings["consultDate"];
                var consultEndTime = individualBookings["consultEndTime"];
                var currentDateTime = moment(new Date(), ["DD-MMM-YY hh:mm A"]).format();
                var consultationEndDateTime = moment(consultDate + " " + consultEndTime, ["DD-MMM-YY hh:mm A"]).format();
                if (currentDateTime >= consultationEndDateTime) { //check if consultation date and time ended
                  completeConsultation(modCode, bookingId, bookings[bookingId]);
                }
              }
            }
          }
        }
      })
  },
};
