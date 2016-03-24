CorrelationOne = React.createClass({

    getInitialState() {
        return {
            showPriceEntryForm: false,
            textAreaValue: "",
            sampleDataString: "",
            rawPrices: [],
            splitIntoCells: false,
            cellValues: []
        };
    },

    enterPrices() {
        this.setState({
            showPriceEntryForm: true
        });
    },

    handleChange(event) {
        var _textAreaNewValue = event.target.value;
        console.log("new value: ", _textAreaNewValue);

        var _allLines = _textAreaNewValue.split("\n");
        var _splitByCommasAndNewLines = [];
        _allLines.forEach(function(line) {
            var _splitLine = line.split(",");
            if (_splitLine.length > 1) {
                _splitByCommasAndNewLines.push(_splitLine);
            }
        });
        console.log("_splitByCommasAndNewLines: ", _splitByCommasAndNewLines);




        this.setState({
            textAreaValue: _textAreaNewValue,
            splitIntoCells: true,
            cellValues: _splitByCommasAndNewLines
        });
    },

    generateSampleDataString() {
        console.log("generate sample data string clicked");
        var _symbols = [
            "AAPL",
            "TWTR",
            "FB",
            "MSFT",
            "INTC",
            "F",
            "MCD",
            "T",
            "DAL",
            "AXP"
        ];
        var _startDate = "2015-01-02";
        var _endDate = "2015-05-27";
        var _that = this;
        _symbols.forEach(function(symbol) {
            console.log("gonna call the function for symbol: ", symbol);
            Meteor.call("checkHistoricalData", symbol, _startDate, _endDate, function(error, result) {
                if (!error && result && result.historicalData) {
                    var _pricesArray = result.historicalData;
                    console.log("_pricesArray: ", _pricesArray);

                    var _pricesSoFar = _that.state.rawPrices;
                    _pricesSoFar.push(_pricesArray);
                    _that.setState({
                        rawPrices: _pricesSoFar
                    });

                    var _sampleDataString = "";

                    console.log("_pricesSoFar length: ", _pricesSoFar.length);

                    if (_pricesSoFar.length === _symbols.length) {
                        console.log("_pricesSoFar length is 10: ", _pricesSoFar);
                        for (var dayIndex = 0; dayIndex < 100; dayIndex++) {
                            var _rowString = dayIndex > 0 ? "\n" : "";
                            _rowString += (new Date(_pricesSoFar[0][dayIndex].date).toISOString()).substring(0,10);
                            console.log(_rowString);
                            for (var stockIndex = 0; stockIndex < _symbols.length; stockIndex++) {
                                var _openPrice = _pricesSoFar[stockIndex][dayIndex].open;
                                var _closePrice = _pricesSoFar[stockIndex][dayIndex].close;
                                var _difference = _closePrice - _openPrice;
                                var _pctDiff = (dayIndex >= 100/2 && stockIndex === 0) ? "" : _difference / _openPrice;
                                _rowString += ("," + _pctDiff);
                            }
                            console.log("_rowString: ", _rowString);
                            _sampleDataString += _rowString;
                        }

                        console.log("SAMPLE STRING: ", _sampleDataString);
                    }
                }
            });
        });
    },

    handleIndividualCellChange() {
        console.log("nothing");
    },

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
    },

    predict() {
        var _noiseVariable = 0.001;
        var _allCellValues = this.state.cellValues;
        console.log("_allCellValues: ", _allCellValues);
        var _numberOfTrainingExamples = 50;
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
        var _stepSize = Math.pow(10, -4);
        var _tolerance = Math.pow(10, -3);
        var _maxIter = 500;
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
        var _answer = "";
        for (var i = _numberOfTrainingExamples; i < _allCellValues.length; i++) {
            _answer += (i === _numberOfTrainingExamples ? "" : "<br>");
            var blah = JSON.stringify(_allCellValues[i]);
            var rowDataa = JSON.parse(blah);
            console.log("rowDataa before: ", rowDataa);
            _answer += rowDataa.shift();
            //set unknown to _noiseVariable
            rowDataa[0] = _noiseVariable;
            //convert to floats
            var _rowDataFloats = [];
            rowDataa.forEach(function(d) {
                _rowDataFloats.push(parseFloat(d));
            });
            console.log("_rowDataFloats: ", _rowDataFloats);
            console.log("rowDataa after: ", rowDataa);
            var _prediction = IgnRegression.utilities.get_dot_product_two_arrays(_rowDataFloats, _weights);
            console.log("prediction: ", _prediction);
            _answer += ("," + _prediction);
            console.log("----------------------------");
        }
        console.log("ANSWER IS: ", _answer);
        $.bootstrapGrowl(_answer, {
            type: 'success',
            align: 'center',
            width: 400,
            delay: 10000000
        });

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
    },

    render() {
        return (
            <div className="container">
                <header>
                    <h1>correlation-one challenge</h1>
                </header>

                <button className="btn btn-default enterPrices" onClick={this.enterPrices}>Enter Prices</button>






                <button className="btn btn-default generateSampleData" onClick={this.generateSampleDataString}>Generate Sample Data String</button>







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
                        <button className="btn btn-default predict" onClick={this.predict}>predict</button>
                    </div> :
                    null
                }




            </div>
        );
    }
});