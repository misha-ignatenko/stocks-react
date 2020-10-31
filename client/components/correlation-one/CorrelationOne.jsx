import { Component } from 'react';

function getRegressionResults(_initialWeightsStringified, _featureMatrix, _actualOutput, stepSize, tolerance, maxIter, _numberOfTrainingExamples, _trainingSet, _noiseVariable) {
    var _initialWghts = JSON.parse(_initialWeightsStringified);

    var reslt = IgnRegression.functions.multiple_regression_gradient_descent(
        _featureMatrix,
        _actualOutput,
        _initialWghts,
        stepSize,
        tolerance,
        maxIter
    );

    var wghts = reslt.weights;
    var iter = reslt.iter;


    var _rss = 0.0;

    for (var i = 0; i < _numberOfTrainingExamples; i++) {
        var _trainingRowStringified = JSON.stringify(_trainingSet[i]);             //length is 11, actual value is at index 1
        var _trainingRow = JSON.parse(_trainingRowStringified);
        //get rid of date
        _trainingRow.shift();       //now length is 10
        var _actualValue = _trainingRow[0];
        //replace actual value with noise coef
        _trainingRow[0] = _noiseVariable;

        //console.log("wgts: ", wghts);
        //console.log(_trainingRow);
        var _prediction = IgnRegression.utilities.get_dot_product_two_arrays(wghts, _trainingRow);
        var _error = _prediction - _actualValue;
        _rss += (_error * _error);
    }


    var _obj = {
        tolerance: tolerance,
        stepSize: stepSize,
        maxIter: maxIter,
        weights: wghts,
        rss: _rss,
        iter: iter
    };
    return _obj;
}
function removeColumnIndicesFromMatrix(_featureMatrix, arrOfFeatureIndicesToExcludeFromModel) {
    var _newFeatureMatrix = [];
    _featureMatrix.forEach(function (rowArr) {
        var _newRow = [];
        rowArr.forEach(function (rowColItem, colIndex) {
            if (arrOfFeatureIndicesToExcludeFromModel.indexOf(colIndex) === -1) {
                _newRow.push(rowColItem);
            }
        });
        _newFeatureMatrix.push(_newRow);
    });
    return _newFeatureMatrix;
}
class CorrelationOne extends Component {

    getInitialState() {
        return {
            showPriceEntryForm: false,
            textAreaValue: "",
            sampleDataString: "",
            rawPrices: [],
            splitIntoCells: false,
            cellValues: [],
            trainingRowsNum: 0,
            stepSize: 4,
            tolerance: 2,
            maxIter: 40000
        };
    }

    enterPrices() {
        $("#answer").html("");

        this.setState({
            showPriceEntryForm: true,
            splitIntoCells: false,
            textAreaValue: ""
        });
    }

    handleChange(event) {
        var _textAreaNewValue = event.target.value;

        var _allLines = _textAreaNewValue.split( /\n/g );
        var _splitByCommasAndNewLines = [];
        var _numberOfTrainingRows = 0;
        _allLines.forEach(function(line) {
            var _splitLine = line.split(",");
            if (_splitLine.length > 1) {
                if (_splitLine[0].indexOf(" 0:00") > -1) {
                    _splitLine[0] = _splitLine[0].substring(0, _splitLine[0].indexOf(" 0:00"));
                }
                if (_splitLine[1]) {
                    _numberOfTrainingRows++;
                }
                _splitByCommasAndNewLines.push(_splitLine);
            }
        });




        this.setState({
            textAreaValue: _textAreaNewValue,
            splitIntoCells: true,
            cellValues: _splitByCommasAndNewLines,
            trainingRowsNum: _numberOfTrainingRows
        });
    }

    handleIndividualCellChange() {
    }

    renderCells() {
        return (
            <div>



                <br/>


                {this.state.cellValues.map((cellValues, index) => {
                    return (<div className="row" key={index}>{cellValues.map((keyy) => {
                        const val = keyy;
                        const _key = index.toString() + "_" + keyy;

                        return <div className="col-md-1" key={_key}><input className="simpleInput" id={_key} key={_key} value={val} onChange={this.handleIndividualCellChange}/></div>;
                    })}<br/></div>)
                })}
            </div>
        );
    }

    predict() {
        var _noiseVariable = 0.001;
        var _allCellValues = this.state.cellValues;
        var _numberOfTrainingExamples = this.state.trainingRowsNum;
        var _trainingSet = [];
        for (var i = 0; i < _numberOfTrainingExamples; i++) {
            var _rowOfDoubles = [_allCellValues[i][0]];
            for (var colIndex = 1; colIndex < _allCellValues[i].length; colIndex++) {
                _rowOfDoubles.push(parseFloat(_allCellValues[i][colIndex]));
            }

            _trainingSet.push(_rowOfDoubles);
        }
        console.log("_trainingSet: ", _trainingSet);

        //option 1.
        //include a random variable
        //do not include S1 for predicting S1 in training set
        //initial weights are all 1/10
        var _featureMatrix = [];
        var _actualOutput = [];
        _trainingSet.forEach(function(pricesForDay) {
            var _prices = JSON.stringify(pricesForDay);
            _prices = JSON.parse(_prices);
            _prices.shift();
            _actualOutput.push(_prices[0]);
            _prices[0] = _noiseVariable;
            _featureMatrix.push(_prices);
        });
        console.log("_featureMatrix: ", _featureMatrix);
        console.log("_actualOutput: ", _actualOutput);
        var _initialWeights = [];
        _featureMatrix[0].forEach(function(item) {
            _initialWeights.push(1/_featureMatrix[0].length);
        });


        var _initialWeightsStringified = JSON.stringify(_initialWeights);
        console.log("_initialWeightsStringified: ", _initialWeightsStringified);


        var _stepSize = Math.pow(10, -this.state.stepSize);
        var _tolerance = Math.pow(10, -this.state.tolerance);
        var _maxIter = this.state.maxIter;
        console.log("hereherehere", _stepSize, _tolerance, _maxIter);
        var _resultFromGradientDescent = IgnRegression.functions.multiple_regression_gradient_descent(
            _featureMatrix,
            _actualOutput,
            _initialWeights,
            _stepSize,
            _tolerance,
            _maxIter
        );
        console.log("RESULT: ", _resultFromGradientDescent);
        var _weights = _resultFromGradientDescent.weights;
        console.log("_weights: ", _weights);



        var _stepSizePowsArray = [
            //3,
            //3.5,
            4,
            //4.5,
            //5
        ];
        var _stepSizeArray = _.map(_stepSizePowsArray, function(pow) {
            return Math.pow(10, -pow);
        });

        var _tolerancePowsArray = [
            //1,
            //1.5
            2,
            //2.5,
            //3,
            //3.5,
            //4
        ];
        var _toleranceArray = _.map(_tolerancePowsArray, function(pow) {
            return Math.pow(10, -pow);
        });

        var _maxIterArray = [
            //250,
            //500,
            //1000,
            //10000,
            //15000,
            40000
            //75000,
            //75000
            //, 10000
            //, 50000
        ];


        //stepSize 4
        //tolerance 2
        //maxIter 40000
        //{"tolerance":0.01,"stepSize":0.0001,"maxIter":50000,"weights":[0.08437538723994861,-0.23520298895145317,0.0835870197105594,-0.056339223469445705,0.07410998120446002,0.26328066062683103,0.1352465854784302,-0.18387878019730358,-0.04397078623929067,-0.0052832452373803565],"rss":4.211200706086055,"iter":30336}

        //stepSize 3.5
        //tolerance 0.5
        //maxIter 1000
        //{"tolerance":0.31622776601683794,"stepSize":0.00031622776601683794,"maxIter":1000,"weights":[0.09862848613543215,-0.22046266512955975,0.09125307787366013,-0.05361543523503756,0.09443086990644672,0.13451694514772236,0.1353085583250636,-0.1586234716246081,-0.020028373811167555,-0.004565167924577194],"rss":4.225621347028339,"iter":912}

        //3.5
        //1
        //5000
        //{"tolerance":0.1,"stepSize":0.00031622776601683794,"maxIter":5000,"weights":[0.0967161180400092,-0.23624773237913452,0.08803001929597244,-0.05571674674938814,0.08796787761555394,0.1772070881694138,0.1397766887896975,-0.17960681912214962,-0.03491570715163283,-0.007139508025893961],"rss":4.216021184664399,"iter":2080}

        //{"tolerance":0.03162277660168379,"stepSize":0.00031622776601683794,"maxIter":75000,"weights":[0.0908819867168768,-0.2355831560263735,0.08469039874940648,-0.0561850903561864,0.07756579450085192,0.2418488305738363,0.13642808250561334,-0.18296305990529443,-0.04181102455227586,-0.005778611551950316],"rss":4.211669497327664,"iter":5631}

        //tolerance 1
        //maxIter 1000
        //stepSize 3.5
        //{"tolerance":0.1,"stepSize":0.00031622776601683794,"maxIter":1000,"weights":[0.0984841297096578,-0.22449114464425637,0.09074233066166487,-0.05425476425773075,0.09393276096182615,0.13821864394171413,0.13674105969132824,-0.16340734636502482,-0.02281651535645431,-0.005287987220346154],"rss":4.223336067682049,"iter":1001}

        //tolerance 1
        //maxIter 500
        //stepSize 3.5
        //{"tolerance":0.1,"stepSize":0.00031622776601683794,"maxIter":500,"weights":[0.09928209701221087,-0.17591194919155823,0.09695484552022714,-0.04336644114299272,0.09596550363646304,0.11711040333015031,0.12008720985888073,-0.11001770190947796,0.004051641914088748,0.003026636134215092],"rss":4.274326043853076,"iter":501}

        var _iterAndWeights = [
            //{"tolerance":0.1,"stepSize":0.00031622776601683794,"maxIter":500,"weights":[0.09928209701221087,-0.17591194919155823,0.09695484552022714,-0.04336644114299272,0.09596550363646304,0.11711040333015031,0.12008720985888073,-0.11001770190947796,0.004051641914088748,0.003026636134215092],"rss":4.274326043853076,"iter":501}
            //, {"tolerance":0.1,"stepSize":0.00031622776601683794,"maxIter":1000,"weights":[0.0984841297096578,-0.22449114464425637,0.09074233066166487,-0.05425476425773075,0.09393276096182615,0.13821864394171413,0.13674105969132824,-0.16340734636502482,-0.02281651535645431,-0.005287987220346154],"rss":4.223336067682049,"iter":1001}
            //, {"tolerance":0.01,"stepSize":0.0001,"maxIter":50000,"weights":[0.08437538723994861,-0.23520298895145317,0.0835870197105594,-0.056339223469445705,0.07410998120446002,0.26328066062683103,0.1352465854784302,-0.18387878019730358,-0.04397078623929067,-0.0052832452373803565],"rss":4.211200706086055,"iter":30336}
        ];

        var _featureIndicesToExclude = [
            [9],
            [3,9],
            [8,9],
            [3,8],
            [3,8,9]
        ];

        _iterAndWeights.forEach(function(iterAndWeightObj) {
            _featureIndicesToExclude.forEach(function(arrOfFeatureIndicesToExcludeFromModel) {

                var _initWghts = JSON.parse(_initialWeightsStringified);
                arrOfFeatureIndicesToExcludeFromModel.forEach(function(blah) {
                    _initWghts.shift();
                });
                var _initWghtsStringified = JSON.stringify(_initWghts);


                console.log("featureMatrix str: ", JSON.stringify(_featureMatrix));


                var _newFeatureMatrix = removeColumnIndicesFromMatrix(_featureMatrix, arrOfFeatureIndicesToExcludeFromModel);
                var _newTrainingSet = removeColumnIndicesFromMatrix(_trainingSet, arrOfFeatureIndicesToExcludeFromModel);


                var _obj = getRegressionResults(
                    _initWghtsStringified,
                    _newFeatureMatrix,
                    _actualOutput,
                    iterAndWeightObj.stepSize,
                    iterAndWeightObj.tolerance,
                    iterAndWeightObj.maxIter,
                    _numberOfTrainingExamples,
                    _newTrainingSet,
                    _noiseVariable
                );
                console.log("NEW OBJ: ", _obj);

                if (_obj.rss < iterAndWeightObj.rss) {
                    console.log("new obj: ", _obj);
                    console.log("old obj: ", iterAndWeightObj);
                }
            });
        });




        var _combinationsOfResults = [];



        _stepSizeArray.forEach(function(stepSize) {
            _toleranceArray.forEach(function(tolerance) {
                _maxIterArray.forEach(function(maxIter) {



                    var _obj = getRegressionResults(_initialWeightsStringified, _featureMatrix, _actualOutput, stepSize, tolerance, maxIter, _numberOfTrainingExamples, _trainingSet, _noiseVariable);
                    _combinationsOfResults.push(_obj);


                });
            });
        });

        console.log("all combinations: ", _combinationsOfResults);
        console.log("stringified: ", JSON.stringify(_combinationsOfResults));



        this.displayAnswer(_numberOfTrainingExamples, this.state.cellValues, _noiseVariable, _weights);

        //$.bootstrapGrowl(_answer, {
        //    type: 'success',
        //    align: 'center',
        //    width: 400,
        //    delay: 10000000
        //});

        //option 2.
        //do not include a random variable
        //do not include S1 for predicting S1 in training set

        //option 3.
        //do not include a random variable
        //do not include S1 for predicting S1 in training set
        //use percentage change for S2...S10 for x days before.

        //option 4.
        //do not include a random variable
        //do not include S1 for predicting S1 in training set
        //use average percentage change for S2...S10 for x days before.
    }

    displayAnswer(_numberOfTrainingExamples, _allCellValues, _noiseVariable, _weights) {
        var _answer = "";
        for (var i = _numberOfTrainingExamples; i < _allCellValues.length; i++) {
            _answer += (i === _numberOfTrainingExamples ? "<h1>Predictions:</h1>" : "<br>");
            var blah = JSON.stringify(_allCellValues[i]);
            var rowDataa = JSON.parse(blah);
            _answer += rowDataa.shift();
            //set unknown to _noiseVariable
            rowDataa[0] = _noiseVariable;
            //convert to floats
            var _rowDataFloats = [];
            rowDataa.forEach(function(d) {
                _rowDataFloats.push(parseFloat(d));
            });
            var _prediction = IgnRegression.utilities.get_dot_product_two_arrays(_rowDataFloats, _weights);
            _answer += ("," + _prediction);
        }
        $("#answer").html(_answer);


        this.setState({
            showPriceEntryForm: false,
            splitIntoCells: false,
            textAreaValue: ""
        });
    }


    changeStepSize() {
        var newVal = this.refs.stepSize.value.trim().length > 0 ? parseFloat(this.refs.stepSize.value.trim()) : "";
        this.setState({
            stepSize: newVal
        });
    }
    changeTolerance() {
        var newVal = this.refs.tolerance.value.trim().length > 0 ? parseFloat(this.refs.tolerance.value.trim()) : "";
        this.setState({
            tolerance: newVal
        });
    }
    changeMaxIter() {
        var newVal = this.refs.maxIter.value.trim().length > 0 ? parseInt(this.refs.maxIter.value.trim()) : "";
        this.setState({
            maxIter: newVal
        });
    }

    render() {
        return (
            <div className="container">
                <header>
                    <h1>correlation-one challenge</h1>
                </header>

                <button className="btn btn-light enterPrices" onClick={this.enterPrices}>Enter Prices</button>

                <br/><br/>
                {this.state.showPriceEntryForm && !this.state.splitIntoCells ?
                    <div className="priceEntryForm">
                        <h3>Enter prices in the following format:</h3>
                        <div className="textAreaEntryDiv">
                            <textarea rows="20" cols="100"
                                      value={this.state.textAreaValue}
                                      onChange={this.handleChange}></textarea>
                        </div>
                    </div> :
                    null
                }

                {this.state.splitIntoCells && this.state.cellValues.length > 1 ?
                    <div>
                        {this.renderCells()}
                        <br/>
                        step size: 10^-<input type="text" value={this.state.stepSize} ref="stepSize" onChange={this.changeStepSize}/><br/>
                        tolerance: 10^-<input type="text" value={this.state.tolerance} ref="tolerance" onChange={this.changeTolerance}/><br/>
                        max iter: <input type="text" value={this.state.maxIter} ref="maxIter" onChange={this.changeMaxIter}/><br/>
                        <br/>
                        <button className="btn btn-light predict" onClick={this.predict}>predict</button>
                        <br/>
                        <br/>
                    </div> :
                    null
                }
                <span className="answer" id="answer"></span>
                <br/>
                <br/>
                <br/>




            </div>
        );
    }
}