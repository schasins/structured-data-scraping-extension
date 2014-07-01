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
 * Show visual representation of the program
**********************************************************************/

function programView(){
  var div = $("#result_table_div")
  div.html("");
  var first_row_str = "<div id='first_row'>First Row:<br>";
  for (var i = 0; i<program.length; i++){
    var item = program[i];
    var program_item_str = "<div><div class='prog_"+item["type"]+"'>"+item["type"]+"</div>";
    for (var j = 0; j<item["first_row_elems"].length; j++){
      var elem = item["first_row_elems"][j];
      elem_str = "<div class='first_row_elem'>"+elem+"</div>";
      program_item_str += elem_str;
      first_row_str += elem_str;
    }
    program_item_str += "</div>";
    div.append($(program_item_str));
  }
  first_row_str += "</div>";
  div.append($(first_row_str));
}

/**********************************************************************
 * Guide the user through defining a list selector
**********************************************************************/

var current_list = null;

/* Turn list processing on and off */

function startProcessingList(){
	current_list = {"type": "list", "selector": {}, "next_button_data": {}, "item_limit": 100000, "demo_list":[], "first_row_elems": []};
	program.push(current_list);
	utilities.sendMessage("mainpanel", "content", "startProcessingList", "");
	var div = $("#result_table_div");
	div.html($("#new_list").html());
	
	div.find(".list").addClass("list-active"); //how we'll display list
	div.find(".radio").click(processNextButtonType);
	div.find(".itemLimit").on('input propertychange paste', processItemLimit);
	div.find(".buttonset").buttonset();
	div.find(".done").click(stopProcessingList);
	div.find(".cancel").click(cancelProcessingList);
}

function stopProcessingList(){
	var demo_list = current_list["demo_list"];
	if (demo_list.length > 0) {current_list["first_row_elems"] = [demo_list[0]];}
	current_list = null;
	utilities.sendMessage("mainpanel", "content", "stopProcessingList", "");
	programView();
}

function cancelProcessingList(){
	program = _.without(program, current_list);
	current_list = null;
	utilities.sendMessage("mainpanel", "content", "stopProcessingList", "");
	programView();
}

/* Collect list information */

function processSelectorAndListData(data){
  if (current_list === null){ return; }
  //store the new selector with the program's list object
  current_list["selector"] = data["selector"];
  //display the list so the user gets feedback
  current_list["demo_list"] = data["list"];
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
