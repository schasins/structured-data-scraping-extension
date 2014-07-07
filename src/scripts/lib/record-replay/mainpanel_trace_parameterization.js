function ParameterizedTrace(trace){
    var trace = trace;

    this.parameterizeXpath = function(parameter_name, original_value) {
        for (var i = 0; i< trace.length; i++){
			var target = trace[i].target;
			if (target === original_value){
				target = {"name": parameter_name, "value": null};
			}
		}
    }

    this.useXpath = function(parameter_name, value) {
        for (var i = 0; i< trace.length; i++){
			var target = trace[i].target;
			if (target.hasOwnProperty("name") && target["name"] === value){
				target = {"name": parameter_name, "value": value};
			}
		}
    }
    
    this.standardTrace(){
		var cloned_trace = clone(trace);
        for (var i = 0; i< cloned_trace.length; i++){
			var target = tracloned_tracece[i].target;
			if (target.hasOwnProperty("name")){
				target = target["value"];
			}
		}
		return cloned_trace;
	}
}
