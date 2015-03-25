/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict'

var getTarget;
var getTargetFunction;
var targetFunctions;
var saveTargetInfo;

(function() {
  var log = getLog('target');

var all_features = ["tag", "class", "id",
 "left", "top", "width", "height",
 "font-size", "font-family", "font-style", "font-weight", "color",
 "background-color", "background-image", "opacity", "z-index",
 "preceding-text",
 "xpath"];

function getFeature(element, feature){
  if (feature === "xpath"){
    return nodeToXPath(element);
  }
  else if (feature === "id"){
    return element.id;
  }
  else if (feature === "preceding-text"){
    return $(element).prev().text();
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

function getFeatures(element){
  var info = {};
  info.xpath = nodeToXPath(element);
  for (var prop in element) {
    if (element.hasOwnProperty(prop)) {
      info[prop] = element.prop;
    }
  }

  var text = element.textContent;
  info.textContent = text;
  var trimmedText = text.trim();
  info.firstWord = trimmedText.slice(0,trimmedText.indexOf(" "));
  info.lastWord = trimmedText.slice(trimmedText.lastIndexOf(" "),trimmedText.length);
  var colonIndex = trimmedText.indexOf(":")
  if (colonIndex > -1){
    info.preColonText = trimmedText.slice(0,colonIndex);
  }
  var children = element.childNodes;
  var l = children.length;
  for (var i = 0; i< l; i++){
    var childText = children[i].textContent;
    info["child"+i+"text"] = childText;
    info["lastChild"+(l-i)+"text"] = childText;
  }

  var prev = element.previousElementSibling;
  if (prev !== null){
    info.previousElementSiblingText = prev.textContent;
  }

  var boundingBox = element.getBoundingClientRect();
  for (var prop in boundingBox) {
    if (boundingBox.hasOwnProperty(prop)) {
      info[prop] = boundingBox.prop;
    }
  }
  var style = window.getComputedStyle(element, null);
  for (var i = 0; i < style.length; i++) {
    var prop = style[i];
    info[prop] = style.getPropertyValue(prop);
  }
  return info;
}

  /* Store information about the DOM node */
  saveTargetInfo = function _saveTargetInfo(target, recording) {
    var targetInfo = {};
    targetInfo.xpath = nodeToXPath(target);
    //change this line to change node addressing approach
    //targetInfo.snapshot = snapshotNode(target);
    targetInfo.snapshot = getFeatures(target);
    if (recording == RecordState.RECORDING) {
      targetInfo.branch = snapshotBranch(target);
    }
    return targetInfo;
  };

  /* The following functions are different implementations to take a target
   * info object, and convert it to a list of possible DOM nodes */ 

  function getTargetSimple(targetInfo) {
	console.log("getTargetSimple", targetInfo, targetInfo.xpath);
    return xPathToNodes(targetInfo.xpath);
  }

  function getTargetSuffix(targetInfo) {

    function helper(xpath) {
      var index = 0;
      while (xpath[index] == '/')
        index++;

      if (index > 0)
        xpath = xpath.slice(index);

      var targets = xPathToNodes('//' + xpath);

      if (targets.length > 0) {
        return targets;
      }

      /* If we're here, we failed to find the child. Try dropping
       * steadily larger prefixes of the xpath until some portion works.
       * Gives up if only three levels left in xpath. */
      if (xpath.split('/').length < 4) {
        /* No more prefixes to reasonably remove, so give up */
        return [];
      }

      var index = xpath.indexOf('/');
      xpathSuffix = xpath.slice(index + 1);
      return helper(xpathSuffix);
    }

    return helper(targetInfo.xpath);
  }

  function getTargetText(targetInfo) {
    var text = targetInfo.snapshot.prop.innerText;
    if (text) {
      return xPathToNodes('//*[text()="' + text + '"]');
    }
    return [];
  }

  function getTargetSearch(targetInfo) {
    /* search over changes to the ancesters (replacing each ancestor with a
     * star plus changes such as adding or removing ancestors) */

    function helper(xpathSplit, index) {
      if (index == 0)
        return [];

      var targets;

      if (index < xpathSplit.length - 1) {
        var clone = xpathSplit.slice(0);
        var xpathPart = clone[index];

        clone[index] = '*';
        targets = xPathToNodes(clone.join('/'));
        if (targets.length > 0)
          return targets;

        clone.splice(index, 0, xpathPart);
        targets = xPathToNodes(clone.join('/'));
        if (targets.length > 0)
          return targets;
      }

      targets = xPathToNodes(xpathSplit.join('/'));
      if (targets.length > 0)
        return targets;

      return helper(xpathSplit, index - 1);
    }

    var split = targetInfo.xpath.split('/');
    return helper(split, split.length - 1);
  }

  function getTargetClass(targetInfo) {
    var className = targetInfo.snapshot.prop.className;
    if (className) {
      //xPathToNodes("//*[@class='" + className + "']");

      var classes = className.trim().replace(':', '\\:').split(' ');
      var selector = '';
      for (var i = 0, ii = classes.length; i < ii; ++i) {
        var className = classes[i];
        if (className)
          selector += '.' + classes[i];
      }

      return $.makeArray($(selector));
    }
    return [];
  }

  function getTargetId(targetInfo) {
    var id = targetInfo.snapshot.prop.id;
    if (id) {
      var selector = '#' + id.trim().replace(':', '\\:');
      return $.makeArray($(selector));
    }
    return [];
  }

  function getTargetComposite(targetInfo) {
    var targets = [];
    var metaInfo = [];

    for (var strategy in targetFunctions) {
      try {
        var strategyTargets = targetFunctions[strategy](targetInfo);
        for (var i = 0, ii = strategyTargets.length; i < ii; ++i) {
          var t = strategyTargets[i];
          var targetIndex = targets.indexOf(t);
          if (targetIndex == -1) {
            targets.push(t);
            metaInfo.push([strategy]);
          } else {
            metaInfo[targetIndex].push(strategy);
          }
        }
      } catch (e) {}
    }

    var maxStrategies = 0;
    var maxTargets = [];
    for (var i = 0, ii = targets.length; i < ii; ++i) {
      var numStrategies = metaInfo[i].length;
      if (numStrategies == maxStrategies) {
        maxTargets.push(targets[i]);
      } else if (numStrategies > maxStrategies) {
        maxTargets = [targets[i]];
        maxStrategies = numStrategies;
      }
    }

    return maxTargets;
  }

  /* Set the target function */
  getTargetFunction = getTargetComposite;

  /* Given the target info, produce a single target DOM node. May get several
   * possible candidates, and would just return the first candidate. */
   /*
  getTarget = function(targetInfo) {
	console.log("targetInfo", targetInfo);
    var targets = getTargetFunction(targetInfo);
    if (!targets) {
      console.log("No target found.");
      log.debug('No target found');
      return null;
    } else if (targets.length > 1) {
      log.debug('Multiple targets found:', targets);
      return null;
    } else {
      return targets[0];
    }
  };
  */

  var getTargetForSimilarity = function(targetInfo) {
    var candidates = getAllCandidates();
    var bestScore = -1;
    var bestNode = null;
    for (var i = 0; i<candidates.length; i++){
  var info = getFeatures(candidates[i]);
  var similarityCount = 0;
  for (var prop in targetInfo) {
    if (targetInfo.hasOwnProperty(prop)) {
      if (targetInfo[prop] === info[prop]){
              similarityCount += 1;
      }
    }
  }
  if (similarityCount > bestScore){
    bestScore = similarityCount;
    bestNode = candidates[i];
  }
    }
    return bestNode;
  };

  getTarget = function(targetInfo) {
    console.log("targetInfo", targetInfo);
    if (! targetInfo){
      return null;
    }
    //we have a useXpathOnly flag set to true when the top level has parameterized on xpath, and normal node addressing approach should be ignored
    if (targetInfo.useXpathOnly){
      var nodes = xPathToNodes(targetInfo.xpath);
      if (nodes.length > 0){
        console.log("using pure xpath: ", nodes[0]);
        return nodes[0];
      }
    }
    var features = targetInfo.snapshot;
    var winningNode = getTargetForSimilarity(features);
    console.log("winningNode: ", winningNode);
    return winningNode;
  }

  /* List of all target functions. Used for benchmarking */
  targetFunctions = {
    simple: getTargetSimple,
    suffix: getTargetSuffix,
    text: getTargetText,
    class: getTargetClass,
    id: getTargetId,
    search: getTargetSearch
  };

})();
