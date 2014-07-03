function setUp(){

  //messages received by this component
  utilities.listenForMessage("content", "mainpanel", "selectorAndListData", processSelectorAndListData);
  utilities.listenForMessage("content", "mainpanel", "nextButtonData", processNextButtonData);
  utilities.listenForMessage("content", "mainpanel", "moreItems", moreItems);
  
  //messages sent by this component
  //utilities.sendMessage("mainpanel", "content", "startProcessingList", "");
  //utilities.sendMessage("mainpanel", "content", "stopProcessingList", "");
  //utilities.sendMessage("mainpanel", "content", "startProcessingNextButton", "");
  //utilities.sendMessage("mainpanel", "content", "getMoreItems", data);
  //utilities.sendMessage("mainpanel", "content", "getNextPage", data);
  
  //handle user interactions with the mainpanel
  $("#start_list").click(startProcessingList);
  $("#start_demonstration").click(startProcessingDemonstration);
  $("#run").click(run);
  $("button").button();	
}

$(setUp);

var program = [];
var results = [];

/**********************************************************************
 * Run the program
**********************************************************************/

function run(){
  results = [];
  runHelper(program,[]);
}

function runHelper(remaining_program, row_so_far){
  if (remaining_program.length === 0){
    results.push(row_so_far);
    resultsView();
    return;
  }
  var prog_item = remaining_program[0];
  if (prog_item["type"] === "list"){
    runList(remaining_program, row_so_far);
  }
  else if (prog_item["type"] === "demonstration"){
    runDemonstration(remaining_program, row_so_far);
  }
}

function runDemonstration(remaining_program, row_so_far){
  var curr_program = remaining_program[0];
  var new_remaining_program = remaining_program.slice(1);
  SimpleRecord.replay(curr_program["trace"], function(){replayCallback(new_remaining_program,row_so_far);});
}

function replayCallback(remaining_program){
  //run the rest of the program for this row
  runHelper(remaining_program,new_row_so_far);
}

var lrd = {"current_items": [], "counter": 0, "total_counter": 0, "no_more_items": false, "type": null, "skip_next": true}; //list retrieval data

function runList(remaining_program, row_so_far){
  var curr_program = remaining_program[0];
  var new_remaining_program = remaining_program.slice(1);
  lrd = {"current_items": [], "counter": 0, "total_counter": 0, "no_more_items": false, "type": curr_program["next_button_data"]["type"], "skip_next": true};
  runListLoop(curr_program,new_remaining_program,row_so_far);
}

function runListLoop(curr_program,new_remaining_program,row_so_far){
  var item = runListGetNextItem(curr_program);
  if (item === null){
    //loop is done
    return;
  }
  else if (item === wait){
    //need to keep looping, but waiting for content script to respond
    setTimeout(function(){runListLoop(curr_program,new_remaining_program,row_so_far);},500);
  }
  else {
    //we have a real item
    var new_row_so_far = row_so_far.slice(0); //copy
    new_row_so_far.push(item);
    //run the rest of the program for this row
    runHelper(new_remaining_program,new_row_so_far);
    //go on to next row
    runListLoop(curr_program,new_remaining_program,row_so_far);
  }
}

/**********************************************************************
 * Communication with the content script to get list items
**********************************************************************/

var wait = {"wait":"wait"};
var waiting_for_items = false;

function runListGetNextItem(program_list){
  var current_items = lrd["current_items"];
  var counter = lrd["counter"];
  if (counter < current_items.length){
    var ret = current_items[counter];
    lrd["counter"]++;
    lrd["total_counter"]++;
    return ret;
  }
  //we haven't yet retireved any items, or we've run out
  
  //if we've passed the item limit or can't find more, we're done
  if (lrd["total_counter"] >= (program_list["item_limit"]-1) || lrd["no_more_items"]){
    return null;
  }
  //still waiting for items from the last call
  if (waiting_for_items){
    return wait;
  }
  //out of items and haven't yet asked for more
  var data = {"selector": program_list["selector"],
	      "next_button_data": program_list["next_button_data"],
	      "item_limit": program_list["item_limit"]};
  if (data["next_button_data"]["type"] === "next_button" && !lrd["skip_next"]){
    utilities.sendMessage("mainpanel", "content", "getNextPage", data);
  }
  lrd["skip_next"] = false;
  utilities.sendMessage("mainpanel", "content", "getMoreItems", data);
  waiting_for_items = true;
  return wait;
}

function moreItems(data){
  if (!waiting_for_items){
    return;
  }
  waiting_for_items = false;
  if (lrd["type"] !== "next_button"){
    //this was a 'more' button, not 'next' button, so these are all
    //the items we could get
    lrd["current_items"] = data["items"];
    lrd["no_more_items"] = true;
  }
  else{
    //this was a 'next' button
    if (_.isEqual(lrd["current_items"],data["items"])){
      //we got a repeat, must have sent message before next button worked
      //let's try again
      //just set skip_next true again so that runListGetNextItem won't try to press next
      lrd["skip_next"] = true; 
      waiting_for_items = false;
    }
    else{
      lrd["current_items"] = data["items"];
      lrd["counter"] = 0;
      lrd["no_more_items"] = data["no_more_items"];
    }
  }
}

/**********************************************************************
 * Show visual representation of the program, the results
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

function resultsView(){
  var div = $("#result_table_div")
  div.html("");
  var table = arrayOfArraysToTable(results);
  div.append(table);
}

function arrayOfArraysToTable(arrayOfArrays){
  var $table = $("<table></table>");
  for (var i = 0; i< arrayOfArrays.length; i++){
    var array = arrayOfArrays[i];
    var $tr = $("<tr></tr>");
    for (var j= 0; j< array.length; j++){
      var $td = $("<td></td>");
      $td.html(array[j]);
      $tr.append($td);
    }
    $table.append($tr);
  }
  return $table;
}

/**********************************************************************
 * Guide the user through making a demonstration recording
**********************************************************************/

var current_demonstration = null;

function startProcessingDemonstration(){
	current_demonstration = {"type": "demonstration", "trace": [], "first_row_elems": []};
	program.push(current_demonstration);
  
  var div = $("#result_table_div");
	div.html($("#new_demonstration").html());
	
	div.find(".start_recording").click(startRecording);
	div.find(".done_recording").click(doneRecording);
	div.find(".cancel_recording").click(cancelRecording);
}

function startRecording(){
  SimpleRecord.startRecording();
}

function doneRecording(){
  current_demonstration["trace"] = SimpleRecord.stopRecording();
  console.log("trace", current_demonstration["trace"]);
	//TODO: whatever has been captured during the demo, add to first row
	current_demonstration = null;
	programView();
}

function cancelRecording(){
  SimpleRecord.stopRecording();
	program = _.without(program, current_demonstration);
	current_demonstration = null;
	programView();
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
  var next_button_data = current_list["next_button_data"];
  //keys should be tag, text, id, and xpath
  for (var k in data){
	  next_button_data[k] = data[k];
  }
}

function processNextButtonType(event){
  if (current_list === null){ return; }
  var $target = $(event.target);
  var next_button_type = $target.attr('id');
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
  current_list["item_limit"] = parseInt(limit);
}
