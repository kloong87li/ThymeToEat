/*  15-237 Spring 2013 Unit Project - Thyme to Eat
  Kenneth Li (kyli), Ivan Liang(hiliang), Rebecca Lui (rhlui)   */ 

var express = require("express"); // imports express
var app = express(); // create a new instance of express

// imports the fs module (reading and writing to a text file)
var fs = require("fs");

// the bodyParser middleware allows us to parse the
// body of a request
app.use(express.bodyParser());

// The global datastores for all userData, and the auth userlist
var userData = {};
var userList = {};

defaultUserInfo = {
    realname: "",
    favorites: {},
    groceryList: {},
    bookmarks: {},
    mealplan: {
        "sun": [],
            "mon": [],
            "tue": [],
            "wed": [],
            "thur": [],
            "fri": [],
            "sat": [],
    }
}
// Asynchronously read file contents, then call callbackFn
function readFile(filename, defaultData, callbackFn) {
    fs.readFile(filename, function (err, data) {
        if (err) {
            console.log("Error reading file: ", filename);
            data = defaultData;
        } else {
            console.log("Success reading file: ", filename);
        }
        if (callbackFn) callbackFn(err, data);
    });
}

// Asynchronously write file contents, then call callbackFn
function writeFile(filename, data, callbackFn) {
    fs.writeFile(filename, data, function (err) {
        if (err) {
            console.log("Error writing file: ", filename);
        } else {
            console.log("Success writing file: ", filename);
        }
        if (callbackFn) callbackFn(err);
    });
}

// Returns success of login
function verifyLogin(user, pass) {
    var result = (userList[user] === pass);
    if (result === false) console.log("Login failed for " + user);
    return result;
}


// Process Registration by creating a userid.txt file and adding an auth entry
app.post("/register", function (request, response) {
    var userID = request.body.formUserID;
    var realName = request.body.formRealName;
    var pass = request.body.formPass;
    if (userList[userID] === undefined) {
        userList[userID] = pass;
        writeFile("userList.txt", JSON.stringify(userList));
        userData[userID] = JSON.parse(JSON.stringify(defaultUserInfo)); //creates copy
        userData[userID].realname = realName;
        console.log("creating new user " + JSON.stringify(userData[userID]))        
        writeFile("userdata/" + userID + ".txt", JSON.stringify(userData[userID]));
        response.send({
            success: true
        });
    } else {
        response.send({
            success: false
        });
    }
});

// Process Login request
app.post("/login", function (request, response) {
    var userID = request.body.loginUserID;
    var pass = request.body.loginPass;
    if (verifyLogin(userID, pass)) {
        response.send({
            success: true
        });
    } else {
        response.send({
            success: false
        });

    }
});

// Updates the userData file for a specific user
function updateUserFile(username) {
    var data = JSON.stringify(userData[username]);
    var filename = "userdata/" + username + ".txt";
    writeFile(filename, data)
}


// Processes mealplan update request
app.put("/mealplan", function (request, response) {
    console.log("Request Body: " + request.body)
    var user = request.body.username;
    var pass = request.body.password;
    var mealplan = JSON.parse(request.body.data);
    if (verifyLogin(user, pass)) {
        userData[user].mealplan = mealplan;
        updateUserFile(user);
        response.send({
            success: true
        });
    } else {
        response.send({
            success: false
        });
    }
});

// Processes grocerylist update request
app.put("/groceries", function (request, response) {
    var user = request.body.username;
    var pass = request.body.password;
    var groceries = JSON.parse(request.body.data);
    if (verifyLogin(user, pass)) {
        console.log("Grocery List attempt " + user)
        userData[user].groceryList = groceries;
        updateUserFile(user);
        response.send({
            success: true
        });
    } else {
        response.send({
            success: false
        });
    }
});

// Processes favorites update request
app.put("/favorites", function (request, response) {
    var user = request.body.username;
    var pass = request.body.password;
    var favorites = JSON.parse(request.body.data);
    if (verifyLogin(user, pass)) {
        userData[user].favorites = favorites;
        updateUserFile(user);
        response.send({
            success: true
        });
    } else {
        response.send({
            success: false
        });
    }
});

// Processes bookmarks update request
app.put("/bookmarks", function (request, response) {
    var user = request.body.username;
    var pass = request.body.password;
    var bookmarks = JSON.parse(request.body.data);
    if (verifyLogin(user, pass)) {
        userData[user].bookmarks = bookmarks;
        updateUserFile(user);
        response.send({
            success: true
        });
    } else {
        response.send({
            success: false
        });
    }
});

/* Supplies entire userdata object for a specific user. Get request
   must contain auth data, since this is session-less system */
app.get("/user/:userID/:password", function (request, response) {
    console.log(request.params);
    var userID = request.params.userID;
    var password = request.params.password;
    if (verifyLogin(userID, password)) {
        response.send({
            user: JSON.stringify(userData[userID]),
            success: true
        });
    } else {
        response.send({
            success: false
        });
    }
});



// This is for serving files in the main directory
app.get("/", function (request, response) {
    response.sendfile("static/index.html");
});

// Servers files in the main directory
app.get("/images/:imageFilename", function (request, response) {
    response.sendfile("static/images/" + request.params.imageFilename);
});

app.get("/:staticFilename", function (request, response) {
    response.sendfile("static/" + request.params.staticFilename);
});


function initServer() {
    // When we start the server, we must load the stored data
    var defaultUserList = "{}";  // Empty auth list
    readFile("userList.txt", defaultUserList, function (err, data) {
        userList = JSON.parse(data);
    });
	// get list of all userdata text files in that folder and read each
    fs.readdir("userdata/", function(err, fileList) {
        for (var i = 0; i < fileList.length; i++ ) {
            var userID = fileList[i].substring(0,fileList[i].length-4)
            setUserData(userID);
        }
    });
	// Reading each userdata file, load it into global userdata indexed by userid
    function setUserData(userID) {
        readFile("userdata/" + userID + ".txt", undefined, function(err, data) {
            userData[userID] = JSON.parse(data);
        });
    }
}

// Initialize the server, bind listen port 8889 
initServer();
app.listen(8889);