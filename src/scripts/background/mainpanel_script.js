function setUp(){

  //messages received by this component
  utilities.listenForMessage("content", "mainpanel", "selectorAndListData", processSelectorAndListData);
  utilities.listenForMessage("content", "mainpanel", "nextButtonData", processNextButtonData);
  utilities.listenForMessage("content", "mainpanel", "moreItems", moreItems);
  utilities.listenForMessage("content", "mainpanel", "capturedData", processCapturedData);
  
  //messages sent by this component
  //utilities.sendMessage("mainpanel", "content", "startProcessingList", "");
  //utilities.sendMessage("mainpanel", "content", "stopProcessingList", "");
  //utilities.sendMessage("mainpanel", "content", "startProcessingNextButton", "");
  //utilities.sendMessage("mainpanel", "content", "getMoreItems", data);
  //utilities.sendMessage("mainpanel", "content", "getNextPage", data);
  //utilities.sendMessage("mainpanel", "content", "startProcessingCapture", "");
  //utilities.sendMessage("mainpanel", "content", "stopProcessingCapture", "");
  
  //handle user interactions with the mainpanel
  $("#start_list").click(startProcessingList);
  $("#start_demonstration").click(startProcessingDemonstration);
  $("#run").click(run);
  $("#download_results").click(download);
  $("button").button();	
}

$(setUp);

var program = [];
var results = [];
var first_row = [];

/**********************************************************************
 * Run the program
 **********************************************************************/

 var stack = [];

 function run(){
  results = [];
  stack = [];
  runHelper(program, 0, []);
}

function runHelper(program, index, row_so_far, push_results){
  console.log("runHelper");
  console.log(row_so_far);
  if (typeof push_results === 'undefined') push_results = true;
  if (program.length === index){
    if (push_results){
      results.push(row_so_far);
      resultsView();
    }
    if (stack.length > 0){
      console.log("Popping off the stack.");
      var next_func = stack[stack.length - 1];
      stack = stack.slice(0,stack.length-1);
      next_func();
    }
    else{
      console.log("Stack empty.  Forcing data display.");
      resultsView(true);
    }
    return;
  }
  var prog_item = program[index];
  if (prog_item.type === "list"){
    runList(program, index, row_so_far);
  }
  else if (prog_item.type === "demonstration"){
    runDemonstration(program, index, row_so_far);
  }
}

var rd = {"program": null, "index": null, "row_so_far": null}; //replay data

function runDemonstration(program, index, row_so_far){
  console.log("runDemonstration");
  console.log(row_so_far);

  //let's start with cleanup.  if this is a demo at index 1, close all tabs
  //opened so far since we'll never need them again
  //somewhat hacky approach, but it'll do for now
  var opened_tabs = [];
  if (index === 1){
    for (var i = 0; i < program.length; i++){
      var prog_element = program[i];
      if (prog_element.type === "demonstration"){
        var trace = prog_element.most_recent_trace;
        var tabIDs = openTabSequenceFromTrace(trace);
        opened_tabs = opened_tabs.concat(tabIDs);
      }
    }
  }
  chrome.tabs.remove(opened_tabs);

  var curr_program = program[index];
  rd = {"program": program, "index": index, "row_so_far": row_so_far};
  var parameterized_trace = curr_program.parameterized_trace;
  
  for (var i = 0; i < row_so_far.length; i++){
    //use current row's xpaths as arguments to parameterized trace
    var xpath = row_so_far[i].xpath;
    parameterized_trace.useXpath("xpath_"+i.toString(), xpath);
    //use current row's strings as arguments to parameterized trace
    var string = row_so_far[i].text;
    parameterized_trace.useTypedString("str_"+i.toString(), string);
    //use current row's frames as arguments to parameterized trace
    var frame = row_so_far[i].frame;
    parameterized_trace.useFrame("frame_"+i.toString(), frame);
  }
  
  //TODO tabs: must adjust trace so that list-related items (and anything else
  //with the same unique frame id happens on our list page)
var standard_trace = parameterized_trace.getStandardTrace();
var config = parameterized_trace.getConfig();
SimpleRecord.replay(standard_trace, config, replayCallback);
}

function replayCallback(replay_object){
  console.log("replayCallback");
  console.log(rd["row_so_far"]);
  console.log("replayObject", replay_object);
  var new_row_so_far = rd.row_so_far;
  var replay_trace = replay_object.record.events;
  var texts = capturesFromTrace(replay_trace);
  rd.program[rd.index].most_recent_trace = replay_trace;
  //var items = _.map(texts, function(a){return {"text": a};});
  runHelper(rd.program, rd.index + 1, new_row_so_far.concat(texts));
}

var lrd;

function runList(program, index, row_so_far){
  console.log("runList");
  console.log(row_so_far);
  var curr_program = program[index];
  //set up all the list retrieval data
  curr_program.lrd = {current_items: [], counter: 0, total_counter: 0, no_more_items: false, type: curr_program.next_button_data.type, skip_next: true, waiting_for_items: false, waiting_tries: 0, next_button_tries: 0};
  runListLoop(curr_program, program, index, row_so_far);
}

function runListLoop(curr_program, program, index, row_so_far){
  console.log("runListLoop");
  console.log(row_so_far);
  lrd = curr_program.lrd;
  var item = runListGetNextItem(curr_program, program, index);
  console.log("item ", item);
  if (item === null){
    //loop is done
    //all the rows for this (possibly nested) loop are done, but may have more rows for an outer loop
    runHelper([],0,[],false);
  }
  else if (item === wait){
    //need to keep looping, but waiting for content script to respond
    setTimeout(function(){runListLoop(curr_program, program, index, row_so_far);},500);
  }
  else {
    //we have a real item
    var new_row_so_far = row_so_far.slice(0); //copy
    new_row_so_far = new_row_so_far.concat(item);
    //go on to next row once we finish the current row
    stack.push(function(){setTimeout(function(){runListLoop(curr_program, program, index, row_so_far);},curr_program.wait);});
    //run the rest of the program for this row
    runHelper(program, index+1, new_row_so_far);
    console.log("returned from runListLoop runHelper call.");
  }
}

/**********************************************************************
 * Communication with the content script to get list items
 **********************************************************************/

 var wait = {"wait":"wait"};

 function runListGetNextItem(program_list, program, index){
  console.log("runListGetNextItem");
  //if we've passed the item limit, we're done
  if (lrd.total_counter >= (program_list.item_limit)){
    console.log("Collected enough data points.");
    return null;
  }
  
  var current_items = lrd.current_items;
  var counter = lrd.counter;
  if (counter < current_items.length){
    var ret = current_items[counter];
    lrd.counter++;
    lrd.total_counter++;
    return ret;
  }
  //we haven't yet retrieved any items, or we've run out
  
  //if we can't find more, we're done
  if (lrd.no_more_items){
    console.log("Can't find any more items.");
    return null;
  }
  //still waiting for items from the last call
  if (lrd.waiting_for_items){
    if (lrd.waiting_tries <= 30){
      console.log("Still waiting for items.");
      lrd.waiting_tries += 1;
      return wait;
    }
    else{
      //we've been waiting a pretty long time
      //seems like maybe the message didn't get through
      console.log("Seems like the message maybe didn't get through.  Ask for more items.");
      lrd.skip_next = true;
    }
  }

  //out of items and haven't yet asked for more
  var data = {"selector": program_list.selector,
  "next_button_data": program_list.next_button_data,
  "item_limit": program_list.item_limit};

  var tab_id = program_list.tab_info.id;
  if (typeof program_list.tab_info.completed_index != 'undefined'){
    var prog_element = program[program_list.tab_info.program_elment_index];
    var trace = prog_element.most_recent_trace;
    var tabIDs = openTabSequenceFromTrace(trace);
    tab_id = tabIDs[program_list.tab_info.completed_index];
  }

  if (data.next_button_data.type === "next_button" && !lrd.skip_next){
    //TODO tabs: send this to the right tab (not frame), not just any old tab
    //if this list is the first program component, tab should always be same
    //otherwise we should be getting it from the previous demo, because
    //when first recorded, we should have figured out which demo events overlapped with the list page's tab
    console.log("Trying to press next button.");
    utilities.sendMessage("mainpanel", "content", "getNextPage", data, null, null, [tab_id]);
  }
  lrd.skip_next = false;
  //TODO tabs: send this to the right tab (not frame), not just any old tab
  console.log("Asking for more items.");
  utilities.sendMessage("mainpanel", "content", "getMoreItems", data, null, null, [tab_id]);
  lrd.waiting_for_items = true;
  lrd.waiting_tries = 0;
  return wait;
}

function moreItems(data){
  console.log("moreItems");
  if (!lrd.waiting_for_items){
    return;
  }
  lrd.waiting_for_items = false;
  if (lrd.type !== "next_button"){
    //this was a 'more' button, not 'next' button, so these are all
    //the items we could get
    lrd.current_items = data.items;
    lrd.no_more_items = true;
  }
  else{
    //this was a 'next' button
    if (_.isEqual(lrd.current_items,data.items)){
      //we got a repeat, must have sent message before next button worked
      //let's try again
      //just set skip_next true again so that runListGetNextItem won't try to press next
      lrd.skip_next = true; 
      lrd.next_button_tries += 1;
      console.log("Same old items.");
      if (lrd.next_button_tries > 30){
        //we've tried 30 times to get the next button to work, and it's still not working
        //time to assume it's the end of the list (sometimes there's a button that 
        //looks like a next button but is grayed out, that sort of thing)
console.log("Tried the next button 30 times now, still no luck.  Give up.");
lrd.no_more_items = true;
}
}
else{
  console.log("New items.")
  lrd.next_button_tries = 0;
  lrd.current_items = data.items;
  lrd.counter = 0;
  lrd.no_more_items = data.no_more_items;
}
}
}

/**********************************************************************
 * Show visual representation of the program, the results
 **********************************************************************/

 function programView(){
  var div = $("#result_table_div");
  div.html("<h4>Process</h4>");
  var first_row_str = "<div id='first_row'><h4>First Row</h4>";
  for (var i = 0; i<program.length; i++){
    var item = program[i];
    var program_item_str = "<div class='clear'><div class='prog_"+item.type+"'>"+item.type+"</div>";
    for (var j = 0; j<item.first_row_elems.length; j++){
      var elem = item.first_row_elems[j];
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

function resultsView(force){
  var len = results.length;
  if (force != true){
    //reduce CPU-boundedness by not doing this for each new row
    if (len > 100 && len%100 !== 0){return;} 
    if (len > 1000 && len%1000 !== 0){return;} 
    if (len > 10000 && len%10000 !== 0){return;}
    if (len > 20000){return;}
  }

  var div = $("#result_table_div");
  div.html("");
  var results_text = arrayOfArraysToText(results);
  var table = arrayOfArraysToTable(results_text);
  div.append(table);
  if (len === 20000){div.append($("<p>Showing results up to the 20,000th row.  To see full results, click 'Download Results' button.</p>"));}
}

function arrayOfArraysToText(arrayOfArraysOfObjects){
  var arrayOfArraysOfText = [];
  for (var i = 0; i< arrayOfArraysOfObjects.length; i++){
    var array = arrayOfArraysOfObjects[i];
    arrayOfArraysOfText.push(_.pluck(array,"text"));
  }
  return arrayOfArraysOfText;
}

function arrayOfArraysToTable(arrayOfArrays){
  //input may either be an array of arrays with text items
  //or array of arrays with dict items, where each dict has text key
  var $table = $("<table></table>");
  for (var i = 0; i< arrayOfArrays.length; i++){
    var array = arrayOfArrays[i];
    var $tr = $("<tr></tr>");
    for (var j= 0; j< array.length; j++){
      var $td = $("<td></td>");
      $td.html(_.escape(array[j]).replace(/\n/g,"<br>"));
      $tr.append($td);
    }
    $table.append($tr);
  }
  return $table;
}


/**********************************************************************
 * Saving results to file
 **********************************************************************/

function download(){
  var results_text = arrayOfArraysToText(results);
  var csv_string = arrayOfArraysToCSV(results_text);
  var blob = new Blob([csv_string], { type: "text/csv;charset=utf-8" });
  var today = new Date();
  saveAs(blob, "relation_scraper_" + today.getFullYear() + "-" + today.getMonth() + "-" + today.getDate() + ".csv");
}

function arrayOfArraysToCSV(content){
  var finalVal = '';

  for (var i = 0; i < content.length; i++) {
    var value = content[i];

    for (var j = 0; j < value.length; j++) {
      var innerValue =  value[j]===null?'':value[j].toString();
      var result = innerValue.replace(/"/g, '""');
      if (result.search(/("|,|\n)/g) >= 0)
        result = '"' + result + '"';
      if (j > 0)
        finalVal += ',';
      finalVal += result;
    }

    finalVal += '\n';
  }

  return finalVal;
}

/**********************************************************************
 * Guide the user through making a demonstration recording
 **********************************************************************/

 var current_demonstration = null;

 function startProcessingDemonstration(){
   current_demonstration = {"type": "demonstration", "first_row_elems": [], "parameterized_trace": [], "original_trace": []};
   program.push(current_demonstration);

   var div = $("#result_table_div");
   div.html($("#new_demonstration").html());

   div.find(".start_recording").click(startRecording);
   div.find(".done_recording").click(doneRecording);
   div.find(".cancel_recording").click(cancelRecording);
   div.find(".start_capturing").click(startProcessingCapture);
   div.find(".stop_capturing").click(stopProcessingCapture);
 }

 function startRecording(){
  SimpleRecord.startRecording();
}

function doneRecording(){
  var trace = SimpleRecord.stopRecording();
  trace = sanitizeTrace(trace);
  current_demonstration.original_trace = trace;
  current_demonstration.parameterized_trace = new ParameterizedTrace(trace);
  
  //TODO tabs: also get the recent_list's tab or frame ids, parameterize on that
  //should probably be tab, since frame may change as next button is clicked
  
  for (var i = 0; i<first_row.length; i++){
    //get xpaths from the first row so far, parameterize on that
    var xpath = first_row[i].xpath;
    current_demonstration["parameterized_trace"].parameterizeXpath("xpath_"+i.toString(), xpath);
    //get strings from the first row so far, parameterize on that
    var string = first_row[i]["text"];
    current_demonstration["parameterized_trace"].parameterizeTypedString("str_"+i.toString(), string);
    //get frames from the first row so far, parameterize on that
    //can't think of a case where we'd need more than the last list's frame
    //but I'll keep it this way in case it's needed in future
    var frame = first_row[i]["frame"];
    current_demonstration["parameterized_trace"].parameterizeFrame("frame_"+i.toString(), frame);
  }
  
  //search the trace for any captured data, add that to the first row
  var items = capturesFromTrace(trace);
  current_demonstration["first_row_elems"] = _.pluck(items, "text");
  first_row.concat(items);
  
  console.log("trace", trace);
  console.log("trace", _.filter(trace, function(obj){return obj.type === "dom";}));
  current_demonstration = null;
  programView();
}

function capturesFromTrace(trace){
  var captured_nodes = {};
  for (var i = 0; i < trace.length; i++){
    var event = trace[i];
    if (event.type !== "dom"){continue;}
    var additional = event.additional;
    if (additional["capture"]){
      var c = additional["capture"];
      //only want one text per node, even though click on same node, for instance, has 3 events
      captured_nodes[c.xpath] = c.text;
    }
  }
  var items = _.map(captured_nodes, function(val,key){return {"text": val, "xpath": key};});
  return items;
}

function sanitizeTrace(trace){
  return _.filter(trace, function(obj){return obj.state !== "stopped";});
}

function cancelRecording(){
  SimpleRecord.stopRecording();
  program = _.without(program, current_demonstration);
  current_demonstration = null;
  programView();
}

var captured = {};

function startProcessingCapture(){
  captured = {};
  utilities.sendMessage("mainpanel", "content", "startProcessingCapture", "");
}

function stopProcessingCapture(){
  utilities.sendMessage("mainpanel", "content", "stopProcessingCapture", "");
}

function processCapturedData(data){
  captured[data.xpath] = data.text;
  var texts = _.map(captured, function(val){return val;});
  $div = $("#captured_texts");
  $div.html("");
  for (var key in captured){
    $div.append($('<div class="first_row_elem">'+captured[key]+'</div>'));
  }
}

/**********************************************************************
 * Guide the user through defining a list selector
 **********************************************************************/

/*
 * TODO tabs.  record the frame that we restrict lists to, so we can
 * use this exact frame if it's the first list
 * if it's not the first list, check if any previous demonstrations did
 * anything on the frame that produced the list
 * if yes, will have to parameterize *the list* on demonstration results
 * /

var current_list = null;

/* Turn list processing on and off */

var tab_id = null;

function startProcessingList(){
	current_list = {"type": "list", "selector": {}, "next_button_data": {}, "item_limit": 100000, "wait": 0, "demo_list":[], "first_row_elems": [], "first_xpaths": [], "tab_info":{}};
	program.push(current_list);

  //if we already know we only want to send to a particular tab, just alert that tab
  if (typeof current_list.tab_info.id != "undefined"){
    utilities.sendMessage("mainpanel", "content", "startProcessingList", "", null, null, [current_list.tab_info.id]);
  }
  else {
    utilities.sendMessage("mainpanel", "content", "startProcessingList", "");
  }

  var div = $("#result_table_div");
  div.html($("#new_list").html());

	div.find(".list").addClass("list-active"); //how we'll display list
	div.find(".radio").click(processNextButtonType);
	div.find(".itemLimit").on('input propertychange paste', processItemLimit);
  div.find(".wait").on('input propertychange paste', processWait);
  div.find(".done_with_first_row").click(stopProcessingFirstRow);
  div.find(".buttonset").buttonset();
  div.find(".done").click(stopProcessingList);
  div.find(".cancel").click(cancelProcessingList);
}

function openTabSequenceFromTrace(trace){
  var completed_events = _.filter(trace, function(event){return event.type === "completed" && event.data.type === "main_frame";});
  var tabIDs = _.map(completed_events, function(event){return event.data.tabId});
  return tabIDs;
}

function stopProcessingList(){
	if (current_list["first_items"]){first_row = first_row.concat(current_list["first_items"]);}
  // if current_list.tab_id appears in the previous demonstration's events anywhere, 
  // must find the correct tab in the replay-time events at replay-time
  if (program.length > 1){
    var tabID = current_list.tab_info.id;

    //working backwards through the program's demonstrations, see if any of them opened
    //the tab in which this list finding was completed
    for (var i = program.length-2; i >= 0; i--){
      var prog_element = program[i];
      if (prog_element.type === "demonstration"){
        var trace = prog_element.original_trace;
        var tabIDs = openTabSequenceFromTrace(trace);
        if (tabIDs.indexOf(tabID) > -1){
          console.log("looks as though we'll use completed index: "+tabIDs.indexOf(tabID));
          current_list.tab_info.program_elment_index = i;
          current_list.tab_info.completed_index = tabIDs.indexOf(tabID);
          break;
        }
      }
    }
  }
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
  //now that we have data from a given tab, assume we're collecting the list only in that tab
  current_list.tab_info.id = data.tab_id;
  utilities.sendMessage("mainpanel", "content", "stopProcessingList", "", null, null, null, [data.tab_id]);
  //store the new selector with the program's list object
  current_list["selector"] = data["selector"];
  //display the list so the user gets feedback
  //recall that data["list"] is a list of xpath, text pairs, where
  //the text item is a list of node texts
  current_list["demo_list"] = _.map(data["list"], function(a){return _.pluck(a,"text");});
  current_list["first_xpaths"] = _.pluck(data["list"][0],"xpath");
  if (data["list"].length > 0) {current_list["first_row_elems"] = current_list["demo_list"][0]; current_list["first_items"] = data["list"][0];}
  //TODO tabs: also need to put the list's tab or frame data into the current_list
  //we'll use it to parameterize any following demos
  //but will also use it to figure out where to send list messages (see below)
  //need to look at the previous demo's events, see if any of them happened on the same tab as this
  //if it did, need to parameterize on that somehow
  var $listDiv = $(".list-active");
  var contentString = arrayOfArraysToTable(arrayOfArraysToText(data["list"]));
  $listDiv.html(contentString);
}

function stopProcessingFirstRow(){
  if (current_list === null){ return; }
  utilities.sendMessage("mainpanel", "content", "stopProcessingFirstRow", "", null, null, [current_list.tab_info.id]);
}

function processNextButtonData(data){
  if (current_list === null){ return; }
  //now that we have data from a given tab, assume we're collecting the list only in that tab
  current_list.tab_info.id = data.tab_id;
  utilities.sendMessage("mainpanel", "content", "stopProcessingList", "", null, null, null, [data.tab_id]);
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
    //if we already know we only want to send to a particular tab, just alert that tab
    if (typeof current_list.tab_info.id != "undefined"){
      utilities.sendMessage("mainpanel", "content", "startProcessingNextButton", "", null, null, [current_list.tab_info.id]);
    }
    else {
      utilities.sendMessage("mainpanel", "content", "startProcessingNextButton", "");
    }
    //TODO: Alter the user how the next click will be interpreted
  }
}

function processItemLimit(event){
  if (current_list === null){ return; }
  var $target = $(event.target);
  var limit = $target.val();
  current_list["item_limit"] = parseInt(limit);
}

function processWait(event){
  if (current_list === null){ return; }
  var $target = $(event.target);
  var wait = $target.val();
  current_list["wait"] = parseInt(wait);
}