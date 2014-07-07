function ParameterizedTrace(trace){
    var trace = trace;

    this.parameterizeXpath = function(parameter_name, original_value) {
        for (var i = 0; i< trace.length; i++){
			var xpath = trace[i].value.data.target.xpath;
			if (xpath === original_value){
				xpath = {"name": parameter_name, "value": null};
			}
		}
    }

    this.useXpath = function(parameter_name, value) {
        for (var i = 0; i< trace.length; i++){
			var xpath = trace[i].value.data.target.xpath;
			if (xpath.hasOwnProperty("name") && xpath["name"] === value){
				xpath = {"name": parameter_name, "value": value};
			}
		}
    }
    
    this.standardTrace = function(){
		var cloned_trace = clone(trace);
        for (var i = 0; i< cloned_trace.length; i++){
			var xpath = trace[i].value.data.target.xpath;
			if (xpath.hasOwnProperty("name")){
				xpath = xpath["value"];
			}
		}
		return cloned_trace;
	}
}
