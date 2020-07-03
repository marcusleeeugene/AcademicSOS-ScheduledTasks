var firebase = require('firebase');

// Initialize Firebase
const FireBaseConfig = {
  apiKey: "AIzaSyBsUJECsPssBTt1ylGFhItVhSkr1AD02JU",
  authDomain: "academicsos-db.firebaseapp.com",
  databaseURL: "https://academicsos-db.firebaseio.com/",
  storageBucket: "academicsos-db.appspot.com",
};

let app = firebase.initializeApp(FireBaseConfig);

module.exports = app.database(); //Database Link
