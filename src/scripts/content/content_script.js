/**********************************************************************
 * Author: S. Chasins
 **********************************************************************/

/**********************************************************************
 * Listeners and general set up
 **********************************************************************/

 var processing_list = false;
 var processing_next_button = false;
 var processing_capture = false;

 var tabID = "setme";

 function off(){
   return !(processing_list || processing_next_button || processing_capture);
 }

//messages received by this component
utilities.listenForMessage("mainpanel", "content", "getMoreItems", getMoreItems);
utilities.listenForMessage("mainpanel", "content", "getNextPage", getNextPage);
utilities.listenForMessage("mainpanel", "content", "startProcessingList", startProcessingList);
utilities.listenForMessage("mainpanel", "content", "stopProcessingList", stopProcessingList);
utilities.listenForMessage("mainpanel", "content", "startProcessingNextButton", startProcessingNextButton);
utilities.listenForMessage("mainpanel", "content", "startProcessingCapture", startProcessingCapture);
utilities.listenForMessage("mainpanel", "content", "stopProcessingCapture", stopProcessingCapture);
utilities.listenForMessage("mainpanel", "content", "stopProcessingFirstRow", stopProcessingFirstRow);

//messages sent by this component
//utilities.sendMessage("content", "mainpanel", "selectorAndListData", data);
//utilities.sendMessage("content", "mainpanel", "nextButtonData", data);
//utilities.sendMessage("content", "mainpanel", "moreItems", moreItems;
//utilities.sendMessage("content", "mainpanel", "capturedData", data);

//user event handling
document.addEventListener('mouseover', outline, true);
document.addEventListener('mouseout', unoutline, true);
document.addEventListener('keydown', outlineAdjustDown, true);
document.addEventListener('keyup', outlineAdjustUp, true);
document.addEventListener('click', listClick, true);
document.addEventListener('click', nextButtonClick, true);
document.addEventListener('click', captureClick, true);

//for debugging purposes, print this tab's tab id
utilities.listenForMessage("background", "content", "tabID", function(msg){tabID = msg; console.log("tab id: ", msg);});
utilities.sendMessage("content", "background", "requestTabID", {});

/**********************************************************************
 * Color guide to show users the node they're about to select
 **********************************************************************/

 var stored_background_colors = {};
 var stored_outlines = {};
 var current_target = null;

 function targetFromEvent(event){
  var $target = $(event.target);
  //if CTRL was pressed, we want not the table cell but the whole row
  if (event.ctrlKey){
    $ps = $target.closest("tr");
    if ($ps){ $target = $ps;}
  }
  return $target.get(0);
}

function outline(event){
  if (off()){return;}
  outlineTarget(targetFromEvent(event));
}

function outlineTarget(target){
  current_target = target;
  $target = $(target);
  stored_background_colors[$target.html()] = $target.css('background-color');
  stored_outlines[$target.html()] = $target.css('outline');
  $target.css('background-color', '#FFA245');
  $target.css('outline', '#FFA245 1px solid');
}

function unoutline(event){
  if (off()){return;}
  unoutlineTarget(targetFromEvent(event));
}

function unoutlineTarget(target){
  $target = $(target);
  $target.css('background-color', stored_background_colors[$target.html()]);
  $target.css('outline', stored_outlines[$target.html()]);
}

function outlineAdjustDown(event){
  if (off()){return;}
  if (event.keyCode === 17){
    unoutlineTarget(current_target);
    outlineTarget($(current_target).closest("tr").get(0));
  }
}

function outlineAdjustUp(event){
  if (off()){return;}
  if (event.keyCode === 17){
    unoutlineTarget(current_target);
    current_target = null;
  }
}

/**********************************************************************
 * Domain-specific functionality
 **********************************************************************/

/* Available features:
 * tag
 * class
 * left, bottom, right, top
 * font-size, font-family, font-style, font-weight, color
 * background-color
 * xpath
 * Additional processing:
 * excludeFirst
 */

 var all_features = ["tag", "class", 
 "left", "bottom", "right", "top", "width", "height",
 "font-size", "font-family", "font-style", "font-weight", "color",
 "background-color", 
 "preceding-text", "text",
 "xpath"];

 function getFeature(element, feature){
  if (feature === "xpath"){
    return xPathToXPathList(nodeToXPath(element));
  }
  else if (feature === "preceding-text"){
    return $(element).prev().text();
  }
  else if (feature === "text"){
    return $(element).text();
  }
  else if (_.contains(["tag","class"],feature)){
    return element[feature+"Name"];
  }
  else if (_.contains(["top", "right", "bottom", "left", "width", "height"], feature)){
    var rect = element.getBoundingClientRect();
    return rect[feature];
  }
  else{
    var style = window.getComputedStyle(element, null);
    return style.getPropertyValue(feature);
  }
}

function featureMatch(feature, value, acceptable_values){
  if (feature === "xpath"){
    return _.reduce(acceptable_values, function(acc, av){ return (acc || (xPathMatch(av, value))); }, false);
  }
  else if (feature === "class"){
    //class doesn't have to be same, just has to include the target class
    //TODO: Decide if that's really how we want it
    return _.reduce(acceptable_values, function(acc, av){ return (acc || (value.indexOf(av) > -1)); }, false);
  }
  else {
    return _.contains(acceptable_values,value);
  }
}

function collapseValues(feature, values){
  if (feature === "xpath"){
    return xPathReduction(values);
  }
  return _.uniq(values);
}

function getAllCandidates(){
  return document.getElementsByTagName("*");
}

/**********************************************************************
 * Domain-independent interpreter
 **********************************************************************/

 function interpretListSelector(feature_dict, exclude_first, suffixes){
  var candidates = getAllCandidates();
  var list = [];
  for (i=0;i<candidates.length;i++){
    var candidate = candidates[i];
    var candidate_ok = true;
    for (var feature in feature_dict){
      var value = getFeature(candidate,feature);
      var acceptable_values = feature_dict[feature]["values"];
      var pos = feature_dict[feature]["pos"];
      var candidate_feature_match = featureMatch(feature, value, acceptable_values);
      if ((pos && !candidate_feature_match) || (!pos && candidate_feature_match)){
        candidate_ok = false;
        break;
      }
    }
    if (candidate_ok){
      console.log(candidate);
      var candidate_subitems = [];
      var candidate_xpath = xPathToXPathList(nodeToXPath(candidate));
      for (var j = 0; j < suffixes.length; j++){
        var xpath = candidate_xpath.concat(suffixes[j]);
        var xpath_string = xPathToString(xpath);
        var nodes = xPathToNodes(xpath_string);
        if (nodes.length > 0){
          candidate_subitems.push(nodes[0]);
        }
      }
      list.push(candidate_subitems);
    }
  }
  if (exclude_first && list.length > 0){
    return list.slice(1,list.length);
  }
  return list;
}

/**********************************************************************
 * User interface
 **********************************************************************/

 var positive_nodes = [];
 var negative_nodes = [];
 var current_selector = null;
 var current_selector_nodes = [];
 var first_click = true;
 var first_row_mode = true;
 var first_row_items = [];
 var first_row_ancestor = null;
 var suffixes = [];
 var likeliest_sibling = null;

function startProcessingList(){
   processing_list = true;

   positive_nodes = [];
   negative_nodes = [];
   current_selector = null;
   current_selector_nodes = [];
   first_click = true;
   first_row_mode = true;
   first_row_items = [];
   first_row_ancestor = null;
   suffixes = [];
   likeliest_sibling = null;
   first_row_ancestor = null;
 }

function stopProcessingList(){
   processing_list = false;
   processing_next_button = false;

  clearHighlights();
}


function stopProcessingFirstRow(){
  first_row_mode = false;
}

function listClick(event){
  if (!processing_list){
    return;
  }
  
  //dehighlight our old list
  clearHighlights();
  
  event.stopPropagation();
  event.preventDefault();

  var target = targetFromEvent(event);

  //if this is the first row still, (so only one pos example)
  //try to make a guess about what the list will be
  //do this by adding a second likely list member to positive examples
  if (first_row_mode){
    first_row_items.push(target);
    first_row_ancestor = findCommonAncestor(first_row_items);
    positive_nodes = [first_row_ancestor]; //get rid of whatever node we used to think was the ancestor
    likeliest_sibling = findSibling(first_row_ancestor, first_row_items);

    var first_row_ancestor_xpath_list = xPathToXPathList(nodeToXPath(first_row_ancestor));
    var xpath_list_length = first_row_ancestor_xpath_list.length;
    suffixes = [];
    for (var i = 0; i < first_row_items.length; i++){
      var descendant_xpath_list = xPathToXPathList(nodeToXPath(first_row_items[i]));
      var suffix = descendant_xpath_list.slice(xpath_list_length, descendant_xpath_list.length);
      suffixes.push(suffix);
    }

    if (likeliest_sibling !== null){
      positive_nodes.push(likeliest_sibling);
    }
  }
  else{
    var target_ancestor = findAncestor(first_row_ancestor,target);
    console.log("target_ancestor", target_ancestor);
    //decide whether it's a positive or negative example based on whether
    //it's in the old list
    if (_.reduce(current_selector_nodes, function(acc,row){return acc || _.contains(row,target_ancestor);}, false)){
      console.log("negative node");
      negative_nodes.push(target_ancestor);
      //if this node was in positive_nodes, remove it
      positive_nodes = _.without(positive_nodes,target_ancestor);
      //if this was our first negative node, remove the likeliest sibling
      positive_nodes = _.without(positive_nodes,likeliest_sibling);
    }
    else{
      console.log("positive node");
      positive_nodes.push(target_ancestor);
      if (first_row_mode){
        first_row_items.push(target_ancestor);
      }
      //if this node was in negative_nodes, remove it
      negative_nodes = _.without(negative_nodes,target_ancestor);
    }
  }

  //synthesize a selector with our new information (node)
  synthesizeSelector();
  
  //highlight our new list and send it to the panel
  highlightCurrent(current_selector_nodes);
  //recall current_selector_nodes is a list of lists
  var textList = _.map(current_selector_nodes, function(nodes){return _.map(nodes, nodeToMainpanelNodeRepresentation);});
  console.log("textList ", textList);
  var data = {"selector":current_selector,"list":textList,"frame_id":SimpleRecord.getFrameId()};
  utilities.sendMessage("content", "mainpanel", "selectorAndListData", data);
  
  //log the new stuff
  console.log(current_selector);
  console.log(current_selector_nodes);
}

function nodeToMainpanelNodeRepresentation(node){
  return {"text": nodeToText(node), "xpath": nodeToXPath(node), "frame": SimpleRecord.getFrameId()};
}

function nodeToText(node){
  //var text = node.innerText;
  return getElementText(node);
}

function getElementText(el) {
    var text = '';
    // Text node (3) or CDATA node (4) - return its text
    if ( (el.nodeType === 3) || (el.nodeType === 4) ) {
        text = el.nodeValue+"\n";
    // If node is an element (1) and an img, input[type=image], or area element, return its alt text
    } else if ( (el.nodeType === 1) && (
            (el.tagName.toLowerCase() == 'img') ||
            (el.tagName.toLowerCase() == 'area') ||
            ((el.tagName.toLowerCase() == 'input') && el.getAttribute('type') && (el.getAttribute('type').toLowerCase() == 'image'))
            ) ) {
        text = el.getAttribute('alt') || '';
        if (text !== ''){text += "\n";}
    // Traverse children unless this is a script or style element
    } else if ( (el.nodeType === 1) && !el.tagName.match(/^(script|style)$/i) ) {
        var children = el.childNodes;
        for (var i = 0, l = children.length; i < l; i++) {
            text += getElementText(children[i]);
        }
    }
    return text;
}

function findCommonAncestor(nodes){
  var xpath_lists = _.map(nodes, function(node){ return xPathToXPathList(nodeToXPath(node)); });
  if (xpath_lists.length === 0){
    console.log("Why are you trying to get the common ancestor of 0 nodes?");
    return;
  }
  var first_xpath_list = xpath_lists[0];
  for (var i = 0; i< first_xpath_list.length; i++){
    var all_match = _.reduce(xpath_lists, function(acc, xpath_list){return acc && _.isEqual(xpath_list[i],first_xpath_list[i]);}, true);
    if (!all_match){ break; }
  }
  var last_matching = i - 1;
  var ancestor_xpath_list = first_xpath_list.slice(0,last_matching+1);
  var ancestor_nodes = xPathToNodes(xPathToString(ancestor_xpath_list));
  return ancestor_nodes[0];
}

function findAncestor(spec_ancestor, node){
  //will return exactly the same node if there's only one item in first_row_items
  console.log("findAncestor", spec_ancestor, node);
  var spec_xpath_list = xPathToXPathList(nodeToXPath(spec_ancestor));
  var xpath_list = xPathToXPathList(nodeToXPath(node));
  var ancestor_xpath_list = xpath_list.slice(0,spec_xpath_list.length);
  var ancestor_xpath_string = xPathToString(ancestor_xpath_list);
  var ancestor_xpath_nodes = xPathToNodes(ancestor_xpath_string);
  return ancestor_xpath_nodes[0];
}

function findSibling(node, descendants){
  if(typeof(descendants)==='undefined') {descendants = [];}
  var xpath_list = xPathToXPathList(nodeToXPath(node));
  var xpath_list_length = xpath_list.length;
  for (var i = (xpath_list.length - 1); i >= 0; i--){
    var index = parseInt(xpath_list[i]["index"]);
    xpath_list[i]["index"] = index + 1;
    var xpath_string = xPathToString(xpath_list);
    var nodes = xPathToNodes(xpath_string);
    if (nodes.length > 0) { 
      //check whether this node has an entry for all desired suffixes
      var has_all_suffixes = true;
      for (var j = 0; j < suffixes.length; j++){
        var suffix = suffixes[j];
        var suffix_xpath_string = xPathToString(xpath_list.concat(suffix));
        var suffix_nodes = xPathToNodes(suffix_xpath_string);
        if (suffix_nodes.length === 0){
          has_all_suffixes = false;
        }
      }
      if (has_all_suffixes){
        return nodes[0];
      }
    }
    if (index > 0){
      xpath_list[i]["index"] = index - 1;
      xpath_string = xPathToString(xpath_list);
      nodes = xPathToNodes(xpath_string);
      if (nodes.length > 0) {
      //check whether this node has an entry for all desired suffixes
      var has_all_suffixes = true;
      for (var j = 0; j < suffixes.length; j++){
        var suffix = suffixes[j];
        var suffix_xpath_string = xPathToString(xpath_list.concat(suffix));
        var suffix_nodes = xPathToNodes(suffix_xpath_string);
        if (suffix_nodes.length === 0){
          has_all_suffixes = false;
        }
      }
      if (has_all_suffixes){
        return nodes[0];
      }
     }
    }
    xpath_list[i]["index"] = index;
  }
  return null;
}

var almost_all_features = _.without(all_features, "xpath");

function synthesizeSelector(features){
  if(typeof(features)==='undefined') {features = ["tag", "xpath"];}
  
  var feature_dict = featureDict(features, positive_nodes);
  if (feature_dict.hasOwnProperty("xpath") && feature_dict["xpath"].length > 3 && features !== almost_all_features){
    //xpath alone can't handle our positive nodes
    return synthesizeSelector(almost_all_features);
  }
  //if (feature_dict.hasOwnProperty("tag") && feature_dict["tag"].length > 1 && features !== all_features){
  //  return synthesizeSelector(all_features);
  //}
  var rows = interpretListSelector(feature_dict, false, suffixes);
  console.log("rows", rows);
  
  //now handle negative examples
  var exclude_first = false;
  for (var j = 0; j < rows.length; j++){
    var nodes = rows[j];
    for (var i = 0; i < nodes.length ; i++){
      var node = nodes[i];
      if (_.contains(negative_nodes, node)){
        if (j === 0){
          exclude_first = true;
        }
        else if (features !== almost_all_features) {
          //xpaths weren't enough to exclude nodes we need to exclude
          console.log("need to try more features.");
          return synthesizeSelector(almost_all_features);
        }
        else {
          console.log("using all our features and still not working.  freak out.");
          console.log(feature_dict);
          //we're using all our features, and still haven't excluded
          //the ones we want to exclude.  what do we do?  TODO
        }
      }
    }
  }
  
  //update our globals that track the current selector and list
  current_selector_nodes = interpretListSelector(feature_dict, exclude_first, suffixes);
  current_selector = {"dict": feature_dict, "exclude_first": exclude_first, "suffixes": suffixes};
}

function featureDict(features, positive_nodes){
  //initialize empty feature dict
  var feature_dict = {};
  for (var i = 0; i < features.length; i++){
    feature_dict[features[i]] = {"values":[],"pos":true};
  }
  //add all positive nodes' values into the feature dict
  for (var i = 0; i < positive_nodes.length; i++){
    var node = positive_nodes[i];
    for (var j = 0; j < features.length; j++){
      var feature = features[j];
      var value = getFeature(node,feature);
      feature_dict[feature]["values"].push(value);
    }
  }

  console.log("featureDict feature_dict", feature_dict);
  
  //where a feature has more then 3 values, it's too much
  //also need to handle xpath differently, merging to xpaths with *s
  var filtered_feature_dict = {};
  for (var feature in feature_dict){
    var values = collapseValues(feature, feature_dict[feature]["values"]);
    console.log(feature, values.length, positive_nodes.length);
    if (feature === "xpath" || (values.length <= 3 && values.length !== positive_nodes.length)){
      console.log("accept feature: ", feature);
      filtered_feature_dict[feature] = {"values":values,"pos":true};
    }
  }

  console.log("returning featureDict filtered_feature_dict", filtered_feature_dict);
  return filtered_feature_dict;
}

/**********************************************************************
 * Helper functions for making and handling xpath lists
 * (my easier to manipulate representation of xpaths)
 **********************************************************************/

 function xPathToXPathList(xpath){
  var xpathList = [];
  for (var i = 0; i<xpath.length; i++){
    var char = xpath[i];
    if (char === "[") {
      var start = i;
      var end = start + 1;
      while (xpath[end] !== "]") {
        end += 1;
      }
      var prefix = xpath.slice(0,start); //don't include brackets
      var suffix = xpath.slice(end+1,xpath.length); //don't include brackets
      var slashIndex = prefix.lastIndexOf("/");
      var nodeName = prefix.slice(slashIndex+1,prefix.length);
      var index = xpath.slice(start+1,end);
      xpathList.push({"nodeName": nodeName, "index": index, "iterable": false});
    }
  }
  return xpathList;
}

function xPathMatch(xPathWithWildcards,xPath){
  if (xPathWithWildcards.length !== xPath.length){
    return false;
  }
  for (var i = 0; i < xPathWithWildcards.length; i++){
    var targetNode = xPathWithWildcards[i];
    var node = xPath[i];
    if (targetNode.nodeName !== node.nodeName){
      return false;
    }
    if (targetNode.iterable === false && targetNode.index !== node.index){
      return false;
    }
  }
  return true;
}

function xPathMerge(xPathWithWildcards, xPath){
  if (xPathWithWildcards.length !== xPath.length){
    return false;
  }
  for (var i = 0; i < xPathWithWildcards.length; i++){
    var targetNode = xPathWithWildcards[i];
    var node = xPath[i];
    if (targetNode.nodeName !== node.nodeName){
      return false;
    }
    if (targetNode.iterable === false && targetNode.index !== node.index){
      targetNode.iterable = true;
    }
  }
  return true;
}

function xPathReduction(xpath_list){
  if (xpath_list.length < 2){
    return xpath_list;
  }
  var xPathsWithWildcards = [];
  xPathsWithWildcards.push(xpath_list[0]);
  for (var i = 1; i < xpath_list.length; i++){
    var new_xpath = xpath_list[i];
    var success = false;
    for (var j = 0; j < xPathsWithWildcards.length; j++){
      var candidate_match = xPathsWithWildcards[j];
      success = xPathMerge(candidate_match, new_xpath);
      //in case of success, candidate_match will now contain the
      //updated, merged xpath
      if (success){
        break;
      }
    }
    if (!success){
      //since couldn't match the new xpath with existing xpaths, add it
      xPathsWithWildcards.push(new_xpath);
    }
  }
  return xPathsWithWildcards;
}

function xPathToString(xpath_list){
  var str = "";
  for (var i = 0; i < xpath_list.length; i++){
    var node = xpath_list[i];
    str += node.nodeName;
    if (node.iterable){
      str += "[*]/";
    }
    else {
      str += "["+node.index+"]/";
    }
  }
  //add the HTML back to the beginning, remove the trailing slash
  return "HTML/"+str.slice(0,str.length-1);
}

/**********************************************************************
 * Handle next buttons
 **********************************************************************/

 function startProcessingNextButton(){
   processing_list = false;
   processing_next_button = true;
 }

 function nextButtonClick(event){
  if (!processing_next_button){
    return;
  }
  event.stopPropagation();
  event.preventDefault();
  
  var next_or_more_button = $(event.target);
  var data = {};
  data["tag"] = next_or_more_button.prop("tagName");
  data["text"] = next_or_more_button.text();
  data["id"] = next_or_more_button.attr("id");
  data["xpath"] = nodeToXPath(event.target);
  data["frame_id"] = SimpleRecord.getFrameId();
  
  //no longer processing next button
  processing_next_button = false;
  processing_list = true;
  
  utilities.sendMessage("content", "mainpanel", "nextButtonData", data);
}

/**********************************************************************
 * For the mainpanel to call when collecting the real data
 **********************************************************************/

 function useSelector(selector){
  clearHighlights();
  current_selector_nodes = interpretListSelector(selector["dict"], selector["exclude_first"], selector["suffixes"]);
  highlightCurrent(current_selector_nodes);
  list = _.map(current_selector_nodes, function(nodes){return _.map(nodes, nodeToMainpanelNodeRepresentation);});
  list = _.filter(list, function(row){return row.length !== 0;}); //TODO schasins: is this a reasonable filter?
  return list;
}

function wholeList(selector, item_limit, get_more_items_func, send_message_func){
  return wholeListHelper([],0,selector, item_limit, get_more_items_func, send_message_func);
}

function wholeListHelper(list_so_far, steps_since_progress, selector, item_limit, get_more_items_func, send_message_func){
  if (list_so_far.length < item_limit && steps_since_progress <= 5){
    var old_length = list_so_far.length;
    get_more_items_func();
    list_so_far = useSelector(selector);
    steps_since_progress ++;
    if (list_so_far.length > old_length){
      steps_since_progress = 0;
    }
    setTimeout(function(){wholeListHelper(list_so_far, steps_since_progress, selector, item_limit, get_more_items_func, send_message_func);},500);
  }
  else{
    send_message_func(list_so_far);
  }
}

function getMoreItems(data){
  //make sure we're set up before we try to send items back to the mainpanel
  //sending items without the frame id will cause the script to fail
  if (SimpleRecord.getFrameId() === null){
    setTimeout(function(){getMoreItems(data);},500);
    return;
  }

  var send_done = function(list){utilities.sendMessage("content", "mainpanel", "moreItems", {"items":list,"no_more_items":true});};
  var send_not_done = function(list){utilities.sendMessage("content", "mainpanel", "moreItems", {"items":list,"no_more_items":false});};
  
  var selector = data["selector"];
  var item_limit = data["item_limit"];
  var next_button_type = data["next_button_data"]["type"];
  
  if (next_button_type === "scroll_for_more"){
    var get_more_items = function(){window.scrollBy(0,1000);};
    wholeList(selector, item_limit, get_more_items, send_done);
  }
  else if (next_button_type === "more_button"){
    var get_more_items = function(){getNextPage(data);};
    wholeList(selector, item_limit, get_more_items, send_done);
  }
  else if (next_button_type === "next_button"){
    //send the current page's contents.  next button clicking handled elsewhere
    var list_so_far = useSelector(selector);
    var button = findNextButton(data["next_button_data"]);
    if (button === null){
      send_done(list_so_far);
    }
    else{
      send_not_done(list_so_far);
    }
  }
  else{
    console.log("Failure.  Don't know how to produce items because don't know next button type.");
  }
}

function getNextPage(data){
  var button = findNextButton(data["next_button_data"]);
  if (button !== null){
    button.click();
  }
}

function findNextButton(next_button_data){
  var next_or_more_button_tag = next_button_data["tag"];
  var next_or_more_button_text = next_button_data["text"];
  var next_or_more_button_id = next_button_data["id"];
  var next_or_more_button_xpath = next_button_data["xpath"];
  var button = null;
  var candidate_buttons = $(next_or_more_button_tag).filter(function(){ return $(this).text() === next_or_more_button_text;});
  //hope there's only one button
  if (candidate_buttons.length === 1){
    button = candidate_buttons[0];
  }
  else{
    //if not and demo button had id, try using the id
    if (next_or_more_button_id !== undefined && next_or_more_button_id !== ""){
      button = $("#"+next_or_more_button_id);
    }
    else{
      //see which candidate has the right text and closest xpath
      var min_distance = 999999;
      var min_candidate = null;
      for (var i=0; i<candidate_buttons.length; i++){
        candidate_xpath = nodeToXPath(candidate_buttons[i]);
        var distance = levenshteinDistance(candidate_xpath,next_or_more_button_xpath);
        if (distance<min_distance){
          min_distance = distance;
          min_candidate = candidate_buttons[i];
        }
      }
      if (min_candidate === null){
        console.log("couldn't find an appropriate 'more' button");
        console.log(next_or_more_button_tag, next_or_more_button_id, next_or_more_button_text, next_or_more_button_xpath);
      }
      button = min_candidate;
    }
  }
  return button;
}


/**********************************************************************
 * Handle captures, our term for scraping a given node's data
 **********************************************************************/

 $(function(){
  additional_recording_handlers["capture"] = function(node){
    var data = {"text": nodeToText(node), "xpath": nodeToXPath(node)};
    utilities.sendMessage("content", "mainpanel", "capturedData", data);
    console.log("capture", data);
    return data;
  };
}); //run once page loaded, because else runs before r+r content script

 function startProcessingCapture(){
  processing_capture = true; //controls color guide
  //TODO: decide whether actions during capture should have their usual effects
  additional_recording_handlers_on["capture"] = true;
}

function stopProcessingCapture(){
  processing_capture = false; //controls color guide
  additional_recording_handlers_on["capture"] = false;
}

function captureClick(event){
  if (processing_capture){
    event.stopPropagation();
    event.preventDefault();
  }
}

/**********************************************************************
 * Helper functions
 **********************************************************************/

var colors = ["#9EE4FF","#9EB3FF", "#BA9EFF", "#9EFFEA", "#E4FF9E", "#FFBA9E", "#FF8E61"];
function highlightCurrent(arrayOfArrays){
  for (var i = 0; i < arrayOfArrays.length ; i++){
    for (var j = 0; j < arrayOfArrays[i].length; j++){
      var node = arrayOfArrays[i][j];
      //TODO: first make sure there is a color in j, add one if there isn't
      highlightNodeC(node, colors[j]);
    }
  }
}

var highlightCount = 0;
var highlights = {};
function highlightNodeC(target, color) {
  highlightCount +=1;
  $target = $(target);
  var offset = $target.offset();
  var boundingBox = target.getBoundingClientRect();
  var newDiv = $('<div/>');
  var idName = 'ringer-hightlight-' + highlightCount;
  newDiv.attr('id', idName);
  newDiv.css('width', boundingBox.width);
  newDiv.css('height', boundingBox.height);
  newDiv.css('top', offset.top);
  newDiv.css('left', offset.left);
  newDiv.css('position', 'absolute');
  newDiv.css('z-index', 1000);
  newDiv.css('background-color', color);
  newDiv.css('opacity', .4);
  newDiv.css('pointer-events', 'none');
  $(document.body).append(newDiv);
  var html = $target.html();
  if (highlights[html]) {highlights[html].push(idName);} else {highlights[html] = [idName];}
  return idName;
}

function dehighlightNode(id) {
  console.log("dehighlightNode");
  $('#' + id).remove();
}

function clearHighlights(){
  console.log("clearHighlights");
  for (var key in highlights){
    var ids = highlights[key];
    _.each(ids, dehighlightNode);
  }
  highlighs = {};
}

function levenshteinDistance (a, b) {
  if(a.length === 0) return b.length; 
  if(b.length === 0) return a.length; 

  var matrix = [];

  // increment along the first column of each row
  var i;
  for(i = 0; i <= b.length; i++){
    matrix[i] = [i];
  }

  // increment each column in the first row
  var j;
  for(j = 0; j <= a.length; j++){
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for(i = 1; i <= b.length; i++){
    for(j = 1; j <= a.length; j++){
      if(b.charAt(i-1) === a.charAt(j-1)){
        matrix[i][j] = matrix[i-1][j-1];
      } else {
        matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, // substitution
                                Math.min(matrix[i][j-1] + 1, // insertion
                                         matrix[i-1][j] + 1)); // deletion
      }
    }
  }

  return matrix[b.length][a.length];
};

function isNumber(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function nodeToXPath(element) {
  //  we want the full path, not one that uses the id since ids can change
  //  if (element.id !== '')
  //    return 'id("' + element.id + '")';
  if (element.tagName.toLowerCase() === 'html'){
    return element.tagName;
  }

  // if there is no parent node then this element has been disconnected
  // from the root of the DOM tree
  if (!element.parentNode){
    return '';
  }

  var ix = 0;
  var siblings = element.parentNode.childNodes;
  for (var i = 0, ii = siblings.length; i < ii; i++) {
    var sibling = siblings[i];
    if (sibling === element){
      return nodeToXPath(element.parentNode) + '/' + element.tagName +
      '[' + (ix + 1) + ']';
    }
    if (sibling.nodeType === 1 && sibling.tagName === element.tagName){
      ix++;
    }
  }
}

function xPathToNodes(xpath) {
  try {
    var q = document.evaluate(xpath, document, null, XPathResult.ANY_TYPE,
      null);
    var results = [];

    var next = q.iterateNext();
    while (next) {
      results.push(next);
      next = q.iterateNext();
    }
    return results;
  } catch (e) {
    console.log('xPath throws error when evaluated', xpath);
    console.log(e);
  }
  return [];
}


