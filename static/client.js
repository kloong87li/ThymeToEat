/*  15-237 Spring 2013 Unit Project - Thyme to Eat
  Kenneth Li (kyli), Ivan Liang(hiliang), Rebecca Lui (rhlui)   */ 

var global = {}; // Global store

global.dragData = {  // Tracks drag state
    "active": false,
        "srcObj": undefined,
        "dragObj": undefined,
        "dragOffset": {}
}

global.resultsPerPage = 12;  // How many to show per resultpage

global.recommendedNutrition = { // Daily allowances
    "FAT": 65,
        "FASAT": 20,
        "CHOLE": .300,
        "NA": 2.400,
        "K": 3.500,
        "CHOCDF": 300,
        "FIBTG": 25,
        "PROCNT": 50,
        "VITA_IU": 5000,
        "VITC": .060,
        "CA": 1.000,
        "FE": .018,
}

global.user = {  // userdata
    name: "",
    id: undefined,
    pass: "",
    favorites: {},
    mealplan: {
        "sun": [],
            "mon": [],
            "tue": [],
            "wed": [],
            "thur": [],
            "fri": [],
            "sat": [],
    },
    bookmarks: {},
    groceryList: {}
}

global.refreshMap = {  // list of functions to call refresh when going back
    groceryList: displayGroceries,
    favorites: displayFavorites,
    bookmarks: displayBookmarks,
    results: function () {
        display_results(global.currentSearchResults);
    },
    recipe: function () {
        displayRecipe(global.currentRecipe);
    },
    mealPlanner: display_planner,
}

global.searchIngredients = {}; // Global of ingredients to add to search criteria
global.currentOffset = 0;  // Search offset 
global.currentQuery = "";  // Current search string
global.neverSearched = true; // Initial state of page on load, first search kicks saerchbar from middle of page to right side, expands bar
global.currentSearchResults;  // Current search result object
global.contentHistory = [];  // History stack
global.currentRecipe = undefined; // Current viewed recipe

$(document).ready(function () { // Callbacks to bind to DOM objects after everything is loaded
    var bgnum = Math.ceil(Math.random() * 5);
    $("#homePage").css("background-image", "url('images/bg" + bgnum + ".jpg')");  // Random BG
    contentOnly("homePage"); 
    $("#plannerButton").click(display_planner);
    $("#backButton").click(goBack);
    $("#expandSideBtn").click(function () {
        toggleSideBar();
    });
    //Bind search submission to search form (enter or button)
    $("#logo").click(resetSearch);
    $("#search").submit(function () {  // Processes search form
        var textQuery = $("#searchText").val();
        // add retrieval of ingredients as well
        if (textQuery !== "" || Object.keys(global.searchIngredients).length > 0) {
            $("#searchText").css("background-image", "url('images/ajax-loader.gif')");
            global.currentOffset = 0;
            recipe_search(textQuery, global.currentOffset);
        }
        return false;
    });
    $("#loginForm").submit(function () {  // Process login form
        var loginUserID = $("#loginUserID").val();
        var loginPass = $("#loginPass").val();
        $.ajax({
            type: "post",
            data: {
                loginUserID: loginUserID,
                loginPass: loginPass
            },
            url: "/login",
            success: function (data) {
                if (data.success) {
                    loggedIn(loginUserID, loginPass);
                } else {
                    alert("Error: User ID or password is incorrect.\nPlease try again.");
                }
            }
        });
        return false;
    });
    $("#closeIngrPopup").click(function () {  // Close popup
        popup("ingredientsPopUp", "hide");
    });
    $("#darkbg").click(function () {  // Hides lightbox
        popup("iframeFloater", "hide");
        $("#remotepage").attr("src", "about:blank");
    });
    $("#registerForm").submit(function () { //Validate register form and submit if OK.
        var formUserID = $("#formUserID").val();
        var formRealName = $("#formRealName").val();
        var formPass = $("#formPass").val();
        var formPass2 = $("#formPass2").val();
        var errorMsg = "";
        if (formUserID.length < 5) {
            errorMsg += "Please choose a username longer than 5 characters.<br/>";
        }
        if (formRealName.length === 0) {
            errorMsg += "Please enter your real name.<br/>";
        }
        if (formPass.length < 6) {
            errorMsg += "Please choose a password at least 6 characters long.<br/>";
        }
        if (formPass !== formPass2) {
            errorMsg += "Password confirmation does not match. Please try again.<br/>";
        }
        if (errorMsg === "") {
            $.ajax({
                type: "post",
                data: {
                    formUserID: formUserID,
                    formRealName: formRealName,
                    formPass: formPass
                },
                url: "/register",
                success: function (data) {
                    if (data.success) {
                        loggedIn(formUserID, formPass);
                        resetSearch();
                    } else {
                        $("#registerError").html("Error: User ID already exists. Please pick another.");
                    }
                }
            });
        } else {
            $("#registerError").html(errorMsg);
        }
        return false;
    });

    // Bind add-ingredients function to ingredients adding form
    $("#searchIngredients").submit(function () {
        if (Object.keys(global.searchIngredients).length > global.resultsPerPage) {
            alert("Maximum ingredient search filters reached.");
        } else {

            var ingredientName = $("#ingredientSearchText").val();
            // add retrieval of ingredients as well
            addSearchIngredient(ingredientName);
            $("#ingredientSearchText").val("");
        }
        return false;
    });
    $("#selectIngrForm").submit(function () {  // Add ingredients from meal plan to grocery list
        var recipe = global.user.selectedRecipe;
        var selected = {}
        var selectedBoxes = $("#selectIngrForm input[type='checkbox']");
        selectedBoxes.each(function () {
            if ($(this).is(":checked")) {
                selected[$(this).attr("id")] = true;
            }
        });
        addGroceries(recipe, selected);
        popup("ingredientsPopUp", "hide");
        return false;
    });

    $("#listButton").click(displayGroceries);
    $("#favButton").click(displayFavorites);
    $("#bookmarksButton").click(displayBookmarks);
    $("#addIngredient").submit(function () {  // Add ingredients manually to grocery list
        var ingr = $("#newGrocery").val();
        global.user.groceryList[ingr] = [];
        displayGroceries();
        $("#newGrocery").val("");
        updateGroceries();
        return false;
    });
    $("#loginButton").click(function () {
        var arg = ($("#login").is(":visible")) ? "hide" : "show";
        popup("login", arg);
    });
    $("#logoutButton").click(function () {
        location.reload();
    });
    $("#registerButton").click(function () {
        contentOnly("register");
    });
 
    $(document).mouseup(function (e) {  // Releases drag event for meal plan
        if (global.dragData.active) {
            $("body").css("cursor", "auto");
            //Check drop areas and process drops
            checkMiniCalendarCollide(e.pageX, e.pageY, "mouseUp") // Add favorite css class to parent

            global.dragData.active = false;
            global.dragData.dragObj.remove(); // Remove from dom
            global.dragData.dragObj = undefined; // unreference to gc
        }
    });
    // Drag moving for mealplan clone
    $(document).mousemove(function (e) {

        if (global.dragData.active) {
            $("body").css("cursor", "move");
            global.dragData.dragObj.offset({
                left: e.pageX - global.dragData.dragOffset.x,
                top: e.pageY - global.dragData.dragOffset.y
            });
            checkMiniCalendarCollide(e.pageX, e.pageY, "hover");

            return false;
        }
    });

    $(".previousBtn").click(function () {  // Search result list prev
        offsetResults(-global.resultsPerPage);
    });
    $(".nextBtn").click(function () {  // Search result list next
        offsetResults(global.resultsPerPage);
    });

    /* Chrome bug workaround: http://stackoverflow.com/questions/1718415,
      doesn't work for crossdomain JSONP though... */
    $(document).bind("ajaxStart", function () {
        $("html").addClass('busy');
    }).bind("ajaxStop", function () {
        $("html").removeClass('busy');
    });

}); //end binds

// After user login succeeds, show personal section buttons, request userdata
function loggedIn(id, pass) {
	global.user.id = id;
	global.user.pass = pass;
	popup("login", "hide");
	$("#headerButtonBar span").css("display", "inline-block");
	$("#headerButtonBar span:last-child").hide();
	getUserData();
}

function resetSearch() {  // Clears search and returns user to homepage
    global.contentHistory = [];
    global.searchIngredients = {}
    $("#searchText").val("");
    $("#searchIngredientList").html("");
    global.neverSearched = true;
    toggleSideBar("reduce");
    $("#mainContent").attr("class", "");
    contentOnly("homePage");
    popup("sideBar", "hide");
}

function getUserData() {  // AJAX request for userData (favs, mealplan, etc)
    $.ajax({
        type: "get",
        url: "/user/" + global.user.id + "/" + global.user.pass,
        success: function (data) {
            if (data.success) {
                var parsedData = JSON.parse(data.user);
                global.user.realname = parsedData.realname;
                global.user.favorites = parsedData.favorites;
                global.user.mealplan = parsedData.mealplan;
                global.user.bookmarks = parsedData.bookmarks;
                global.user.groceryList = parsedData.groceryList;
            } else {
                loginError();
            }
        }
    });
}

function collisionCheck(x, y, targetSelect) {  // Checks target element bounds for drag event
    var target = $("#" + targetSelect);
    return (x > target.offset().left && x < target.offset().left + target.outerWidth() &&
         	y > target.offset().top && y < target.offset().top + target.outerHeight());
}

function checkMiniCalendarCollide(x, y, type) {  // Checks mealplan calendar drag destination
    var days = $(".mealDay");
    days.each(function (i) {
        var id = $(this).attr("id");
        if (collisionCheck(x, y, id)) {
            if (type === "mouseUp") {
                if (global.user.id !== undefined) {
                    var newDay = id.replace("Meals", "");
                    moveMealPlan(global.dragData.srcDay, newDay, global.dragData.srcObj);
                    display_planner();
                    $(this).css("border", "none");
                    $(this).css("background-color", "transparent");
                } else {
                    loginError();
                }

            } else if (type === "hover") {
                $(this).css("border", "2px dotted black");
                $(this).css("background-color", "#CFCFCF");
            }
        } else {
            $(this).css("border", "none");
            $(this).css("background-color", "transparent");
        }
    });

}

/* Moves an object from the #hidden div to visible and back
   instead of showing and hidding, which keeps visibility state
   less ambiguous (display is inherited, instead of per element)*/

function popup(popItem, action) {  
    if (popItem === undefined) {
        $("#popupContent > div").each(function (i) {
            moveElement($(this).attr("id"), "hidden");
            moveElement("sideBar", "popupContent");
        });
    } else if (popItem !== undefined) {
        if (action === "hide") {
            moveElement(popItem, "hidden");
        } else if (action === "show") {
            moveElement(popItem, "popupContent");
        }
    }
}

// moves selected dom element to destination element
function moveElement(selected, destination) {
    var moveElement = $("#" + selected);
    moveElement.detach();
    $("#" + destination).append(moveElement);
}

/* called when an ingredient is added to search criteria, also 
  creates dom element to display added ingredient */
function addSearchIngredient(ingredientName) {
    if (global.searchIngredients[ingredientName] !== undefined || ingredientName === "") {
        return;
    } // already exists
    var entry = $("<li>");
    var del = $("<span>").addClass("delBtn");
    //defines the removal behavior of an added ingredient
    del.click(function () {
        delete global.searchIngredients[ingredientName];
        $(this.parentNode).remove();
    });
    entry.append(del);
    entry.append(ingredientName);
    //add icons to delete and make optional 
    $("#searchIngredientList").prepend(entry);
    //Global
    global.searchIngredients[ingredientName] = "required";
}

/* creates URL for an api call to Yummly with the given parameters of mainsearch
  as well as extra ingredient filters. These filters are not strictly boolean, 
  but more of a as-close-as-it-gets */
function generateSearchURL(textQuery, ingredients, offset) {
    if (offset === undefined) {
        offset = 0;
    }
    var base = "http://api.yummly.com/v1/api/recipes?";
    var auth = "_app_id=20eddb8c&_app_key=471004eeaa1ac162498cf5a78750f5de";
    var url = "";
    if (textQuery !== "") {
        url += "&q=" + textQuery;
    }
    for (entry in ingredients) {
        url += "&allowedIngredient[]=" + entry;
    }
    if (url === "") {
        return undefined;
    }
    url += "&maxResult=" + global.resultsPerPage + "&start=" + offset;
    return base + auth + url;
}

//performs ajax call to YummlyAPI
function recipe_search(textQuery, offset) {
    //string, array, returns a datastore of results of Yummly API call 
    var searchURL = generateSearchURL(textQuery, global.searchIngredients, offset);
    if (searchURL === undefined) {
        console.log("error no search params");
        return;
    }
    $("html").addClass('busy');
    $.ajax({
        type: "GET",
        url: searchURL,
        dataType: "jsonp",
        success: function (data) {
            $("#searchText").css("background-image", "none");
            //call display results
            global.currentQuery = textQuery;
            display_results(data);
            $("html").removeClass('busy');
        }
    });
}

// Formats cooking time string
function formatCooktime(seconds) {
    var result = "";
    if (seconds >= 60) {
        var hh = Math.floor(seconds / 3600);
        var mm = Math.floor((seconds - (hh * 3600)) / 60);
        var hours = (hh > 0) ? hh + " hours" + ((mm > 0) ? ", " : "") : "";
        var minutes = (mm > 0) ? mm + " minutes" : "";
        result = "Cook Time: " + hours + minutes;
    }
    return result;
}

//creates a div container for each search result item and appends relevent dom elements
function populateSearchResult(result) {
    var clickRecipe = function () {
        var recipeID = result.id;
        var simpResult = result;
        getRecipe(recipeID, simpResult);
    }
    var li = $("#hidden li.resultItem").clone();  // Uses template from hidden div
    if (result.smallImageUrls[0] !== undefined) {
        var thumbURL = result.smallImageUrls[0].replace(".s.", ".l.");  // Get big image
    } else {
        thumbURL = "images/default_food_image.jpg";
    }
    var thumbnailContainer = li.children(".resultThumbnailContainer");
    thumbnailContainer.css("background-image", "url('" + thumbURL + "')");
    thumbnailContainer.css("background-repeat", "no-repeat");
    thumbnailContainer.css("background-size", "cover");
    thumbnailContainer.click(clickRecipe);
    var bookmarker = $("<div>").addClass("bookmarkIndicator");
    if (global.user.bookmarks[result.id] !== undefined) {  // If it's bookmarked, show icon
        bookmarker.css("background-image", "url('images/added_bookmarkMini.png')");
    } else {
        bookmarker.css("background-image", "url('images/add_bookmarkMini.png')");
    }
    thumbnailContainer.append(bookmarker);
    bookmarker.click(function (event) {  // Bind toggle for bookmark
        event.stopPropagation();
        if (global.user.id !== undefined) {
            var arg = result;
            if (global.user.bookmarks[arg.id] === undefined) {
                addToBookmarks({
                    "simpRecipe": arg
                });
                bookmarker.css("background-image", "url('images/added_bookmarkMini.png')");
            } else {
                delete global.user.bookmarks[arg.id];
                bookmarker.css("background-image", "url('images/add_bookmarkMini.png')");
                updateBookmarks();
            }
        } else {
            loginError();
        }
    });
    if (global.user.favorites[result.id] !== undefined) {  // If it's favorited, show icon
        thumbnailContainer.append($("<div>").addClass("favoriteIndicator"));
    }
    var resultDescContainer = li.children(".resultDescContainer");
    title = resultDescContainer.children("h3");
    title.html(result.recipeName);
    title.click(clickRecipe);
    // Displays cook time
    var formattedTime = formatCooktime(result.totalTimeInSeconds);
    if (cooktime != "") {
        var cooktime = $("<p>").html(formattedTime);
        resultDescContainer.append(cooktime);
    }
    return li;
}

//changes the classes of sideBar and mainContent to give more real estate to the latter (fluid layout)
function toggleSideBar(action) {
    //css add / remove class to the sidebar (width = wider)
    //css add / remove class to maincontent ( margin-left = something )
    if ((action === "expand") || ((action === undefined) && ($("#sideBar").hasClass("sideBarReduced")))) {
        moveElement("searchContainer", "sideSearch");
        $("#searchContainer").css("display", "block");
        $("#sideBar").addClass("sideBarExpanded");
        $("#sideBar").removeClass("sideBarReduced");
        $("#mainContent").addClass("mainContentReduced");
        $("#mainContent").removeClass("mainContentExpanded");
        $("#expandSideBtn").attr("src", "images/shrink_tab.png");
    } else if ((action === "reduce") || ((action === undefined) && ($("#sideBar").hasClass("sideBarExpanded")))) {
        if (global.neverSearched) moveElement("searchContainer", "homePage");
        else moveElement("searchContainer", "hidden");
        $("#sideBar").addClass("sideBarReduced");
        $("#sideBar").removeClass("sideBarExpanded");
        $("#mainContent").addClass("mainContentExpanded");
        $("#mainContent").removeClass("mainContentReduced");
        $("#expandSideBtn").attr("src", "images/expand_tab.png");
    }
}

// changes offset of the search results (pagination)
function offsetResults(offsetChange) {
    var oldOffset = global.currentOffset;
    if (global.currentOffset + offsetChange < global.currentSearchResults.totalMatchCount) global.currentOffset += offsetChange;
    if (global.currentOffset < 0) global.currentOffset = 0;
    if (oldOffset !== global.currentOffset) {
        recipe_search(global.currentQuery, global.currentOffset);
    }
}

// Hides all other divs in maincontent except for the desired one.
// global.contentHistory keeps stack of previously viewed pages
function contentOnly(showContent) {
    $("#mainContent > div").hide();
    if (global.contentHistory.length > 0) {
        $("#backButton").css("visibility", "visible");
    } else {
        $("#backButton").css("visibility", "hidden");
    }
    $("#" + showContent).show();
    window.scrollTo(0, 0);
    popup();
    if (global.contentHistory[global.contentHistory.length - 1] != showContent) {
        global.contentHistory.push(showContent);
    }
}

// Goes back through the history stack and also calls refresh functions respectively
function goBack() {
	global.contentHistory.pop()
	if (global.contentHistory.length > 1) {
		var lastContent = global.contentHistory.pop();
		if (global.refreshMap[lastContent] !== undefined) {
			global.refreshMap[lastContent]();
		} else {
			contentOnly(lastContent);
		}
	} else {
		resetSearch();
	}
}

// called after a search: generates the search display screen
function display_results(result) { //read combined datastore
	// Kick out the powerSearch sidebar
	popup("sideBar", "show");
	if (!$("#sideBar").is(":visible")) {
		toggleSideBar("expand");
	}
    if (global.neverSearched) {
        toggleSideBar("expand");
        neverSearched = false;
    }	
	global.currentSearchResults = result; // keep global
	var results = result["matches"];
	$("#resultsHeader > h2").html('Results for "' + $("#searchText").val() + '"');
	var searchIng = [];
	for (entry in global.searchIngredients) {
		searchIng.push(entry);
	}
	if (searchIng.length) $("#resultsHeader > h4").html("with ingredients: " + searchIng.join(", "));
	$("#recipeResults").html("");
	if (result.totalMatchCount !== 0) {  // Something found!
		if (result.criteria.resultsToSkip === 0) { // Show prev, or hide if first page
			$(".previousBtn").hide();
		} else {
			$(".previousBtn").show();
		}
		if ((result.criteria.resultsToSkip + results.length) == result.totalMatchCount) { // Show next, or hide if last page
			$(".nextBtn").hide();
		} else {
			$(".nextBtn").show();
		}

		$("#resultsHeader").children("h3").html(result.totalMatchCount + " results found. Displaying: " +
			 (Number(result.criteria.resultsToSkip) + 1) + " to " + (Number(result.criteria.resultsToSkip) + Number(results.length)));
		for (var i = 0; i < results.length; i++) {  // Build each search result listing box
			var new_li = populateSearchResult(results[i]);
			$("#recipeResults").append(new_li);
		}
	} else {
		$("#resultsHeader").children("h3").html("No recipes found.");
	}
	contentOnly('results');
}


//called after clicking on a recipe link
//uses DOM manipulation to dynamically generate the recipe information page
function displayRecipe(recipe) {
    global.currentRecipe = recipe;
    contentOnly('recipe');
    $(".recipe h1").html(recipe.name);
    if (recipe.images[0].hostedLargeUrl !== undefined) {    //check for available images
        var imageURL = recipe.images[0].hostedLargeUrl;
    } else {
        var imageURL = "images/default_food_image.jpg";
    }
    //creates each html element and appainds it to the container
    $(".recipeImage").html("");
    $(".recipeImage").css("background-image", "url(" + imageURL + ")");
    var servings = $("<p>").html("Number of Servings: " + recipe.numberOfServings);
    $(".recipeInfo").html("");
    $(".recipeInfo").append(servings);
    if (recipe.totalTime) {
        var totalTime = $("<p>").html("Total Preparation Time: " + recipe.totalTime);
        $(".recipeInfo").append(totalTime);
        var clock = $("<canvas>").attr({
            "id": "cookTime",
            "width": "90",
            "height": "90"
        });
        $(".recipeInfo").append(clock);
        var hours = Math.floor(recipe.totalTimeInSeconds / 3600);
        var minutes = Math.floor((recipe.totalTimeInSeconds - hours * 3600) / 60);
        drawClock("cookTime", 40, minutes, hours);
    }
    $(".ingredients").html("");
    $(".ingredients").append($("<h3>").html("Ingredients"));
    recipe.ingredientLines.forEach(function (ingredientItem) {
        var ingredient = $("<li>").html(ingredientItem);
        $(".ingredients").append(ingredient);
    });
    $(".recipeSource").html(recipe.source.sourceDisplayName);
    $(".preparationLink").unbind("click");
    $(".preparationLink").click(function () {
        $("#remotepage").attr("src", recipe.source.sourceRecipeUrl);
        popup("iframeFloater", "show");
    });
    if (global.user.favorites[recipe.simpRecipe.id] === undefined) {
        $(".addFavButton").attr("src", "images/add_favorite.png");
        $("#favorite").html("Favorite");
    } else {
        $(".addFavButton").attr("src", "images/added_favorite.png");
        $("#favorite").html("Unfavorite");
    }
    //rebind all buttons on the page i.e favorite, bookmark, and mealplan
    $(".addFavButton").unbind("click");
    $(".addFavButton").click(function () {
        if (global.user.id !== undefined) {
            var arg = recipe;
            if (global.user.favorites[arg.simpRecipe.id] === undefined) {
                addToFavorites(arg);
                $(".addFavButton").attr("src", "images/added_favorite.png");
                $("#favorite").html("Unfavorite");
            } else {
                delete global.user.favorites[arg.simpRecipe.id];
                $(".addFavButton").attr("src", "images/add_favorite.png");
                $("#favorite").html("Favorite");
                updateFavorites();
            }
        } else {
            loginError();
        }
    });
    //check if recipe is already in favorites, if so, use alt image
    if (global.user.bookmarks[recipe.simpRecipe.id] === undefined) {
        $(".addBookmarkButton").attr("src", "images/add_bookmark.png");
        $("#bookmark").html("Bookmark");
    } else {
        $(".addBookmarkButton").attr("src", "images/added_bookmark.png");
        $("#bookmark").html("Unbookmark");
    }
    $(".addBookmarkButton").unbind("click");
    $(".addBookmarkButton").click(function () {
        if (global.user.id !== undefined) {
            var arg = recipe;
            if (global.user.bookmarks[arg.simpRecipe.id] === undefined) {
                addToBookmarks(arg);
                $(".addBookmarkButton").attr("src", "images/added_bookmark.png");
                $("#bookmark").html("Unbookmark");
            } else {
                delete global.user.bookmarks[arg.simpRecipe.id];
                $("#bookmark").html("Bookmark");
                $(".addBookmarkButton").attr("src", "images/add_bookmark.png");
            }
        } else {
            loginError();
        }
    });
    $(".addMealButton").unbind("click");
    $(".addMealButton").click(function (e) {

        var arg = ($("#mealplanMini").is(":visible")) ? "hide" : "show";
        $("#mealplanMini").attr("class", "vertical");
        var leftOffset = $(".addMealButton").offset().left;
        var topOffset = $(".addMealButton").offset().top + $(".addMealButton").height();
        popup("mealplanMini", arg);
        $("#mealplanMini").offset({
            left: leftOffset,
            top: topOffset
        });
        $(".mealDayMini").unbind("click");
        $(".mealDayMini").css("cursor", "pointer");
        $(".mealDayMini").click(function () {
            if (global.user.id !== undefined) {
                var id = $(this).attr("id");
                var arg = recipe;
                global.user.mealplan[id.replace("Drop", "")].push(arg.simpRecipe);
                $(".mealDayMini").not($(this)).css("visibility", "hidden");
                $(this).hide(333, function () {
                    popup("mealplanMini", "hide");
                    $(this).show();
                    $(".mealDayMini").css("visibility", "visible");
                });
                updateMealplan();
            } else {
                loginError();
            }
        });

    });
    drawNutrition(recipe.nutritionEstimates);
}

//jQuery ajax call to Yummly API for a search query
function getRecipe(recipeID, simpRecipe) {
    var auth = "?_app_id=20eddb8c&_app_key=471004eeaa1ac162498cf5a78750f5de";
    var recipeURL = "http://api.yummly.com/v1/api/recipe/" + recipeID + auth;
    $.ajax({
        type: "GET",
        url: recipeURL,
        dataType: "jsonp",
        success: function (data) {
            data.simpRecipe = simpRecipe;
            displayRecipe(data);
        }
    });
}

//CANVAS usage: draws a graph of the given nutrition info from yummly api
//displays "no nutrition info available" if none is available
function drawNutrition(nutrition) {
    var canvas = document.getElementById("nutritionGraph");
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    $("#nutritionLabels").html("");
    if (nutrition.length <= 0) {
        $("#nutritionGraph").height("250px");
        $("#nutritionLabels").html("No nutrition information available...");
        return undefined;
    } else {
        $("#nutritionGraph").height("350px");
        var x = 0;
        var y = 0;
        for (var i = 0; i < nutrition.length; i++) {
            var key = nutrition[i].attribute;
            if (global.recommendedNutrition[key] !== undefined) {
                var displayName = nutrition[i].description;
                $("#nutritionLabels").append($("<div>").html(displayName));
                var percent = nutrition[i].value / global.recommendedNutrition[key];
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;
                ctx.shadowBlur = 3;
                ctx.shadowColor = "black";
                ctx.fillStyle = "#900";
                ctx.fillRect(x, y, percent * 200 + 1, 6);
                y += 12;
            }
        }
    }
}

//called when user is not logged in
function loginError() {
    alert("You must be logged in to use this feature!");
}

//ajax "put" calls:
//the following functions call our node.js server and updates the user information on the server-side
function updateMealplan() {
    $.ajax({
        type: "put",
        url: "/mealplan",
        data: {
            "username": global.user.id,
                "password": global.user.pass,
                "data": JSON.stringify(global.user.mealplan)
        },
        success: function (response) {
            if (!response.success) {
                alert("Error updating mealplan on server!");
            } else {
                console.log("updated mealplan");
            }
        }
    });
}

function updateGroceries() {
    console.log("called updating groceries");
    $.ajax({
        type: "put",
        url: "/groceries",
        data: {
            "username": global.user.id,
                "password": global.user.pass,
                "data": JSON.stringify(global.user.groceryList)
        },
        success: function (response) {
            if (!response.success) {
                alert("Error updating groceryList on server!");
            } else {
                console.log("updated groceries");
            }
        }
    });
}

function updateFavorites() {
    $.ajax({
        type: "put",
        url: "/favorites",
        data: {
            "username": global.user.id,
                "password": global.user.pass,
                "data": JSON.stringify(global.user.favorites)
        },
        success: function (response) {
            if (!response.success) {
                alert("Error updating favorites on server!");
            } else {
                console.log("updated favorites");
            }
        }
    });
}

function updateBookmarks() {
    $.ajax({
        type: "put",
        url: "/bookmarks",
        data: {
            "username": global.user.id,
                "password": global.user.pass,
                "data": JSON.stringify(global.user.bookmarks)
        },
        success: function (response) {
            if (!response.success) {
                alert("Error updating bookmarks on server!")
            } else {
                console.log("updated bookmarks")
            }
        }
    });
}

//function for displaying the user's meal planner
//uses DOM manipulation to render the food calendar with the user's stored mealplan
function display_planner() {
    if (global.user.id !== undefined) {
        popup("sideBar", "show");
        if (global.contentHistory[global.contentHistory.length - 1] !== "mealPlanner") toggleSideBar("reduce");
        contentOnly('mealPlanner');
        var daysContainers = $(".mealDay");
        daysContainers.each(function (index) {
            $(this).html("");
            var day = $(this).attr("id").replace("Meals", "");
            for (var i = 0; i < global.user.mealplan[day].length; i++) {
                var recipe = global.user.mealplan[day][i];
                recipe.index = i;
                var new_item = createPlannedMeal(day, recipe);
                $(this).append(new_item);
            }
        });
    } else {
        loginError();
    }
}

//called by the above function to create an li, corresponding to each planned meal in the user's mealplan
function createPlannedMeal(day, recipe) {
    var li = $("<li>").addClass("plannedMeal");
    var title = $("<h4>").html(recipe.recipeName);
    title.css("cursor", "pointer");
    title.mouseover(function (e) {
        var result = recipe;
        popupMeal(result, e.pageX, e.pageY);
    });
    title.mouseleave(function () {
        $("#tempMeal").remove();
    });
    title.click(function () {
        var result = recipe;
        getRecipe(result.id, result);
    });
    var plannerButtons = $("<div>").addClass("mealButtons");
    var deleteBtn = $("<div>").addClass("delBtn");
    deleteBtn.css("cursor", "pointer");
    deleteBtn.mousedown(function (e) {
        e.stopPropagation();
        var current = day;
        global.user.mealplan[current].splice(recipe.index, 1);
        updateMealplan();
        display_planner();
    });
    var ingredientBtn = $("<div>").addClass("plannerIngrBtn").html("Add Ingredients");
    ingredientBtn.css("cursor", "pointer");
    ingredientBtn.click(function () {
        var result = recipe;
        popupIngrList(result);
    });
    plannerButtons.append(deleteBtn);
    li.append(plannerButtons);
    li.append(title);
    li.append(ingredientBtn);
    //initializes data for the drag and drop interaction of the calendar
    plannerButtons.mousedown(function (e) {
        var result = recipe;
        global.dragData.srcObj = result;
        global.dragData.srcDay = day;
        global.dragData.srcDomObj = $(this);
        global.dragData.dragObj = $("<div>").html($(this).html());
        global.dragData.dragObj.width("150px");
        global.dragData.dragObj.addClass("plannedMeal dragged");
        global.dragData.active = true;
        global.dragData.dragOffset = {
            "x": parseInt($(this).width() / 4),
                "y": parseInt($(this).height() / 4)
        };
        $("body").append(global.dragData.dragObj);
        return false;
    });
    return li;
}

//generates the popup list for the user to select ingredients to add to their shopping list
function popupIngrList(recipe) {
    recipe.selectAll = false;
    global.user.selected = {}
    global.user.selectedRecipe = recipe;
    generateIngrChecklist(global.user.selectedRecipe, global.user.selected);
    $("#selectAllIngr").prop("checked", false);
    popup("ingredientsPopUp", "show");
    var leftOffset = $(window).width() / 2 - $("#ingredientsPopUp").width() / 2;
    var topOffset = $(window).height() / 2 - $("#ingredientsPopUp").height() / 2;
    $("#ingredientsPopUp").css("top", topOffset);
    $("#ingredientsPopUp").css("left", leftOffset);
}

//creates each ingredient checkbox using DOM manipulation
function generateIngrChecklist(recipe, selected) {
    selectedAll = recipe.selectAll ? "+ All" : "- All";
    $("#selectAllIngr").html(selectedAll);
    var container = $("#selectIngList");
    container.html("");
    recipe.ingredients.forEach(function (ingredient) {
        var new_li = $("<li>").addClass("ingredientItem");
        var checkbox = $("<input type='checkbox'>");
        new_li.append(checkbox);
        checkbox.css("display", "inline-block").attr("id", ingredient);
        var p = $("<p>").html(ingredient).css("display", "inline");
        new_li.append(p);
        container.append(new_li);
    });
    $("#selectAllIngr").unbind("click");
    $("#selectAllIngr").click(function () {
        current = recipe.selectAll;
        recipe.selectAll = !current;
        var boxes = $("#selectIngrForm input[type='checkbox']");
        boxes.each(function () {
            $(this).prop("checked", recipe.selectAll);
        });
    });
}

//adds selected groceries to user datastore
function addGroceries(recipe, selected) {
    for (ingr in selected) {
        if (selected[ingr]) {
            if (global.user.groceryList[ingr] === undefined) {
                global.user.groceryList[ingr] = [recipe];
            } else {
                global.user.groceryList[ingr].push(recipe);
            }
        }
    }
    updateGroceries();
}


//moves a planned recipe from the currentDay to the newDay, and updates it in the user's datastore
function moveMealPlan(currentDay, newDay, recipe) {
    global.user.mealplan[newDay].push(global.user.mealplan[currentDay][recipe.index]);
    global.user.mealplan[currentDay].splice(recipe.index, 1);
    updateMealplan();

}

//uses the searchREsult generator to create a popup element for when a user hovers
//     over a recipe title
function popupMeal(recipe, x, y) {
    var popup_item = populateSearchResult(recipe);
    popup_item.attr("id", "tempMeal");
    popup_item.css("position", "fixed");
    $("#hidden").append(popup_item);
    popup("tempMeal", "show");
    var leftOffset = x - $("#tempMeal").width() / 2;
    var wHeight = $(window).height();
    var topOffset = ((y + 15) > wHeight - $("#tempMeal").height()) ? (y - 30 - $("#tempMeal").height()) : y + 15;
    $("#tempMeal").offset({
        left: leftOffset,
        top: topOffset
    });
    $("#tempMeal").css("z-index", "5");
}

// display function for the groceries list
function displayGroceries() {
    if (global.user.id !== undefined) {
        popup("sideBar", "show");
        if (global.contentHistory[global.contentHistory.length - 1] !== "groceryList") toggleSideBar("reduce");
        contentOnly("groceryList");
        var container = $("#groceries");
        container.html("");
        for (ingredient in global.user.groceryList) {
            var new_li = createGroceryItem(ingredient, global.user.groceryList[ingredient]);
            container.prepend(new_li);
        }
    } else {
        loginError();
    }
}

//creates an li to append to the grocery list
function createGroceryItem(ingredient, sources) {
    var new_li = $("<li>").addClass("groceryItem");
    var p = $("<p>").html(ingredient).css("display", "inline-block");
    p.html(ingredient);
    var del = $("<div>").addClass("delBtn").css("display", "inline-block");
    del.click(function () {
        var ingr = ingredient;
        delete global.user.groceryList[ingr];
        updateGroceries();
        displayGroceries();
    });
    new_li.append(del);
    new_li.append(p);
    if (sources.length > 0) {
        sources.forEach(function (recipe) {
            var source = $("<span>").html(recipe.recipeName);
            source.css("cursor", "pointer");
            source.click(function () {
                getRecipe(recipe.id, recipe);
            });
            source.css("cursor", "pointer");
            source.mouseover(function (e) {
                var result = recipe;
                popupMeal(result, e.pageX, e.pageY);
            });
            source.mouseleave(function () {
                //popup();
                $("#tempMeal").remove();
            });
            source.click(function () {
                var result = recipe;
                getRecipe(result.id, result);
            });
            new_li.append(source);
        });
    }
    return new_li;
}

//display function for the favorites list
function displayFavorites() {
    if (global.user.id !== undefined) {
        popup("sideBar", "show");
        if (global.contentHistory[global.contentHistory.length - 1] !== "favorites") {
            toggleSideBar("reduce");
        }
        contentOnly("favorites");
        var container = $("#recipeFavorites");
        container.html("");
        for (key in global.user.favorites) {
            var new_li = generateRecipeItem(global.user.favorites[key], global.user.favorites, function () {
                updateFavorites();
                displayFavorites();
            })
            container.prepend(new_li);
        };
        var removeFavImg = $("<img>").attr("src", "images/remove_favorite.png");
        removeFavImg.addClass("removeFavImg button");
        $("#recipeFavorites .itemDel").append(removeFavImg);
        var removeText = $("<div>").html("Remove");
        $("#recipeFavorites .itemDel").append(removeText);
    } else {
        loginError();
    }
}

//called by the favorite button on the recipe display page
// adds it to the user's datastore
function addToFavorites(recipe) {
    if (global.user.id !== undefined) {
        console.log(recipe.name + "Added to Favorites");
        global.user.favorites[recipe.simpRecipe.id] = recipe.simpRecipe;
        updateFavorites();
    } else {
        loginError();
    }
}

//disaply function for the bookmarks page
function displayBookmarks() {
    if (global.user.id !== undefined) {
        popup("sideBar", "show");
        if (global.contentHistory[global.contentHistory.length - 1] !== "bookmarks") toggleSideBar("reduce");
        contentOnly("bookmarks");
        var container = $("#bookmarksList");
        container.html("");
        for (key in global.user.bookmarks) {
            var new_li = generateRecipeItem(global.user.bookmarks[key], global.user.bookmarks, function () {
                updateBookmarks();
                displayBookmarks();
            })
            container.prepend(new_li);
        };
        var removeBookmarkImg = $("<img>").attr("src", "images/remove_bookmark.png");
        removeBookmarkImg.addClass("removeBookmarkImg");
        $("#bookmarksList .itemDel").append(removeBookmarkImg);
        var removeText = $("<div>").html("Remove");
        $("#bookmarksList .itemDel").append(removeText);
    } else {
        loginError();
    }
}

//similar to favorites, adds the selected recipe to user's bookmarks
function addToBookmarks(recipe) {
    if (global.user.id !== undefined) {
        console.log("Added to Bookmarks");
        global.user.bookmarks[recipe.simpRecipe.id] = recipe.simpRecipe;
        updateBookmarks();

    } else {
        loginError();
    }
}

//generates a generic recipeItem li so that it can be used in the displayFavorites and displayBookmarks pages
//takes a resultItem object with recipe information, a list to update when the remove button is clicked,
// and a callback function that should be called in order to update the list.
function generateRecipeItem(result, list, callbackUpdate) {
    var clickRecipe = function () {
        var recipeID = result.id;
        var simpResult = result;
        getRecipe(recipeID, simpResult);
    }
    var li = $("<li>");
    li.addClass("favItem");
    var thumbnailContainer = $("<div>").addClass("favThumbnailContainer");
    var thumbnail = $("<img>").attr("src", result.smallImageUrls[0]);
    thumbnail.addClass("favThumbnail");
    thumbnail.click(clickRecipe);
    thumbnailContainer.append(thumbnail);
    var resultDescContainer = $("<div>").addClass("favDescContainer");
    var title = $("<h3>").html(result.recipeName);
    resultDescContainer.append(title);
    title.click(clickRecipe);
    // Displays cook time
    var formattedTime = formatCooktime(result.totalTimeInSeconds);
    if (cooktime != "") {
        var cooktime = $("<p>").html(formattedTime);
        resultDescContainer.append(cooktime);
    }
    if (result.attributes.cuisine !== undefined) {
        var cuisine = $("<p>").html("Cuisine: " + result.attributes.cuisine.join(", "));
        resultDescContainer.append(cuisine);
    }
    var ingredients = $("<p>").html("Ingredients: " + result.ingredients.join(", "));
    resultDescContainer.append(ingredients);
    var del = $("<div>").addClass("itemDel");
    del.click(function () {
        delete list[result.id];
        callbackUpdate();

    });
    li.append(thumbnailContainer);
    li.append(resultDescContainer);
    li.append(del);
    return li;
}

//CANVAS useage: draws a clock, corresponding to the recipe's preparation time, if available
function drawClock(canvasID, radius, minutes, hours) {
    var offset = 5;
    var cx = radius + offset;
    var cy = cx;

    var ctx = $("#" + canvasID)[0].getContext('2d');

    ctx.lineWidth = 5; // Outer circle
    ctx.strokeStyle = '#990000';
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.translate(cx, cy); // Start from center
    ctx.rotate(-Math.PI / 2); // Offset to 12:00 being up
    ctx.strokeStyle = "black";
    ctx.fillStyle = "white";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";

    ctx.save(); // Hour ticks    
    for (var i = 0; i < 12; i++) {
        ctx.beginPath();
        ctx.rotate(Math.PI / 6);
        ctx.moveTo(radius * 0.8, 0);
        ctx.lineTo(radius * 0.9, 0);
        ctx.stroke();
    }
    ctx.restore();

    ctx.save(); // Hour hand
    ctx.rotate(hours * (Math.PI / 6) + (Math.PI / 360) * minutes)
    ctx.beginPath();
    ctx.moveTo(-(radius * 0.1), 0);
    ctx.lineTo(radius * 0.6, 0);
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();

    ctx.save(); // Minute hand
    ctx.rotate((Math.PI / 30) * minutes)
    ctx.beginPath();
    ctx.moveTo(-(radius * 0.15), 0);
    ctx.lineTo(radius * 0.7, 0);
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();
}