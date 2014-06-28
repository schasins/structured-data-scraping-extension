function setUp(){

  //messages received by this component
  utilities.listenForMessage("content", "mainpanel", "selectorAndListData", processSelectorAndListData);
  utilities.listenForMessage("content", "mainpanel", "nextButtonData", processNextButtonData);
  
  //messages sent by this component
  //utilities.sendMessage("mainpanel", "content", "startProcessingList", "");
  //utilities.sendMessage("mainpanel", "content", "stopProcessingList", "");
  //utilities.sendMessage("mainpanel", "content", "startProcessingNextButton", "");
  
  //handle user interactions with the mainpanel
  $("#start_list").click(startProcessingList);
  $("button").button();
}

$(setUp);

var program = [];

/**********************************************************************
 * Guide the user through defining a list selector
**********************************************************************/

var current_list = null;

/* Turn list processing on and off */

function startProcessingList(){
	current_list = {"selector": {}, "next_button_data": {}, "item_limit": 100000};
	program.push(current_list);
	utilities.sendMessage("mainpanel", "content", "startProcessingList", "");
	var dialog = $("<div></div>");
	dialog.html($("#new_list").html());
	dialog.dialog({
	  dialogClass: "no-close",
	  buttons: [
	    {text: "Done", click: stopProcessingList},
	    {text: "Cancel", click: cancelProcessingList}
	  ],
	  open: function() {
	    $(".radio").click(processNextButtonType);
	    $(".itemLimit").on('input propertychange paste', processItemLimit);
	    $(".buttonset").buttonset();
	    dialog.find(".list").addClass("list-active");
	  }
	});
}

function stopProcessingList(){
	current_list = null;
	utilities.sendMessage("mainpanel", "content", "stopProcessingList", "");
	$(this).dialog( "close" );
}

function cancelProcessingList(){
	program = _.without(program, current_list);
	current_list = null;
	utilities.sendMessage("mainpanel", "content", "stopProcessingList", "");
	$(this).dialog( "close" );
}

/* Collect list information */

function processSelectorAndListData(data){
  if (current_list === null){ return; }
  //store the new selector with the program's list object
  current_list["selector"] = data["selector"];
  //display the list so the user gets feedback
  var list = data["list"];
  var $listDiv = $(".list-active");
  var contentString = ""
  for (var j = 0; j<list.length; j++){
    contentString+="<div>"+_.escape(list[j])+"</div>";
  }
  $listDiv.html(contentString);
}

function processNextButtonData(data){
  if (current_list === null){ return; }
  //store the next button data with the program's list object
  next_button_data = current_list["next_button_data"] = data["selector"];
  //keys should be tag, text, id, and xpath
  for (var k in data){
	  next_button_data[k] = data[k];
  }
}

function processNextButtonType(event){
  if (current_list === null){ return; }
  var $target = $(event.target);
  var next_button_type = $target.attr('class');
  current_list["next_button_data"]["type"] = next_button_type;
  if (next_button_type !== "scroll_for_more"){
    utilities.sendMessage("mainpanel", "content", "startProcessingNextButton", "");
    //TODO: Alter the user how the next click will be interpreted
  }
}

function processItemLimit(event){
  if (current_list === null){ return; }
  var $target = $(event.target);
  var limit = $target.val();
  current_list["item_limit"] = limit;
}
