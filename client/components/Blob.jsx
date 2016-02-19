var _dimension = 10;

Blob = React.createClass({

    getInitialState() {
        return {
            textAreaValue: "",
            splitIntoCells: false,
            cellValues: [],
            randomCount: null,
            countAfter: null,
            right: null,
            left: null,
            top: null,
            bottom: null
        };
    },

    handleChange(event) {
        var _textAreaNewValue = event.target.value;
        var _allLines = _textAreaNewValue.split("\n");
        var _cleanLines = [];
        _allLines.forEach(function(line) {
            if (line.length === _dimension) {
                _cleanLines.push(line.split(""));
            }
        })
        if (_cleanLines.length === 10) {
            this.setState({
                splitIntoCells: true,
                cellValues: _cleanLines
            });
        }
    },

    getRowAndColumnIndices(index) {
        var column = index % _dimension;

        return [(index - column) / _dimension, column];
    },

    calculate() {
        var _totalBooleanAccesses = 0;
        var _cellsNotAccessed = _.range(0,_dimension*_dimension);


        var _that = this;

        var _randomIndex = _.random(0, _dimension*_dimension - 1);
        //find the first one
        var _randomCoord = this.getRowAndColumnIndices(_randomIndex);

        var _alreadyCheckedAndTheyAreZero = [];

        var _totalBoolCountForRandom = 1;
        while (!this.isCellAtIndexOne(_randomIndex)) {
            _totalBoolCountForRandom++;
            _alreadyCheckedAndTheyAreZero.push(_randomIndex);
            _randomIndex = _.random(0, _dimension*_dimension - 1);
            //find the first one
            _randomCoord = this.getRowAndColumnIndices(_randomIndex);
        }
        var _initOneCoord = _randomCoord;
        console.log("total number of boolean accesses to pick the first nonzero cell: ",  _totalBoolCountForRandom);
        console.log("initial one coord: ", _randomCoord);


        this.setState({
            randomCount: _totalBoolCountForRandom
        })

        var _connectedIndicesArr = [_randomIndex];

        var _indicesAlreadyAccessed = [_randomIndex];
        var _connectedBlobIndicesArr = [_randomIndex];
        var _frontierArr = [];




        var _attemptTwoNumberOfRuns = 0;

        function _attemptTwo(startIndex) {
            _attemptTwoNumberOfRuns++;

            //can check up, below, right, and left if they werent' already checked
            var _indexUp = startIndex - _dimension >= 0 ? startIndex - _dimension : null;
            var _indexDown = startIndex + _dimension <= _dimension*_dimension - 1 ? startIndex + _dimension : null;
            var _indexLeft = startIndex % _dimension >= 1 ? startIndex - 1 : null;
            var _indexRight = startIndex % _dimension <= (_dimension - 2) ? startIndex + 1 : null;

            //check to get rid of those already checked
            var _neighborsToCheck = [];
            if (_indexUp && _.indexOf(_indicesAlreadyAccessed, _indexUp) === -1) {
                _neighborsToCheck.push(_indexUp);
            }

            if (_indexDown && _.indexOf(_indicesAlreadyAccessed, _indexDown) === -1) {
                _neighborsToCheck.push(_indexDown);
            }

            if (_indexLeft && _.indexOf(_indicesAlreadyAccessed, _indexLeft) === -1) {
                _neighborsToCheck.push(_indexLeft);
            }

            if (_indexRight && _.indexOf(_indicesAlreadyAccessed, _indexRight) === -1) {
                _neighborsToCheck.push(_indexRight);
            }

            _frontierArr = [];
            console.log("gonna check these neighbors: ", _neighborsToCheck);

            _neighborsToCheck.forEach(function(neighborIndex) {
                _totalBooleanAccesses++;
                _indicesAlreadyAccessed.push(neighborIndex);
                if (_that.isCellAtIndexOne(neighborIndex)) {
                    _connectedBlobIndicesArr.push(neighborIndex);

                    //check if it's not already in frontier
                    if (_.indexOf(_frontierArr, neighborIndex) === -1) {
                        _frontierArr.push(neighborIndex);
                    }
                }

            });

            console.log("frontier arr is now: ", _frontierArr);

            _frontierArr.forEach(function(frontierIndex) {
                if (_attemptTwoNumberOfRuns <= 1000) {
                    _attemptTwo(frontierIndex);
                    if (_attemptTwoNumberOfRuns === 1000) {
                        console.log("ERRRRRRRR");
                    }
                }
            })
        }


        _attemptTwo(_randomIndex);
        console.log("ANSWER: ", _connectedBlobIndicesArr);
        console.log("total bool accesses: ", _totalBooleanAccesses);

        this.setState({
            countAfter: _totalBooleanAccesses
        });

        console.log("indices checked: ", _indicesAlreadyAccessed.length);
        console.log("indices chedked uniq: ", _.uniq(_indicesAlreadyAccessed).length);
        _.uniq(_indicesAlreadyAccessed).forEach(function(index) {
            var _coord = _that.getRowAndColumnIndices(index);
            var _id = _coord[0] + "_" + _coord[1];
            var _selector = $("#" + _id);
            if (_selector.html() == 1) {
                //_selector.removeClass("btn-default").addClass("btn-info");
            } else {
                _selector.removeClass("btn-default").addClass("btn-success");
            }
        });




        _.uniq(_connectedBlobIndicesArr).forEach(function(index) {
            var _coord = _that.getRowAndColumnIndices(index);
            var _id = _coord[0] + "_" + _coord[1];
            var _selector = $("#" + _id);
            //if (_selector.html() == 1) {
            //    _selector.removeClass("btn-default").addClass("btn-info");
            //} else {
            _selector.removeClass("btn-default").addClass("btn-info");
            //}
        });


        var _right = 0;
        var _left = _dimension - 1;

        _connectedBlobIndicesArr.forEach(function(index) {
            var _c = _that.getRowAndColumnIndices(index)[1];
            if (_c > _right) {
                _right = _c;
            }
            if (_c < _left) {
                _left = _c;
            }
        });


        var _top = (_.min(_connectedBlobIndicesArr) - (_.min(_connectedBlobIndicesArr) % _dimension)) / _dimension;
        var _bottom = (_.max(_connectedBlobIndicesArr) - (_.max(_connectedBlobIndicesArr) % _dimension)) / _dimension;
        this.setState({
            top: _top,
            bottom: _bottom,
            left: _left,
            right: _right
        });








        console.log("connected indices arr: ", _connectedIndicesArr);

    },

    isCellAtIndexOne(index) {
        var _rowAndCol = this.getRowAndColumnIndices(index);
        return this.state.cellValues[_rowAndCol[0]][_rowAndCol[1]] == 1;
    },

    clearCells() {
        this.setState({
            splitIntoCells: false,
            cellValues: []
        });

    },

    nothing(event) {
    },

    renderCells() {
        return (
            <div>
                {this.state.cellValues.map((cellValues, y) => {
                    return (<div className="row" key={y}>{cellValues.map((cell, x) => {
                        let _key = y + "_" + x;
                        let _class = "btn btn-default" + ((cell === "1") ? " active" : "");

                        return <button className={_class} id={_key} key={_key} onClick={this.nothing}>{cell}</button>;
                    })}<br/></div>)
                })}
            </div>
        );
    },

    render() {
        return (
            <div className="container">
                <header>
                    <h1>welcome to the blob app</h1>
                </header>

                <h4>enter blob matrix below:</h4>
                {!this.state.splitIntoCells ?
                    <div className="textAreaEntryDiv">
                            <textarea rows="20" cols="50"
                                      value={this.state.textAreaValue}
                                      onChange={this.handleChange}></textarea>
                    </div> :
                    <div>
                        {this.renderCells()}
                        <br/>
                        <button className="btn btn-default" onClick={this.calculate}>calculate blob</button>
                        <button className="btn btn-default" onClick={this.clearCells}>clear</button>

                        <br/>
                        <h3>results:</h3>
                        <h5>total boolean access count to randomly pick an initial cell with value one: {this.state.randomCount}</h5>
                        <h5>cell reads after initialization cell with value one was picked randomly: {this.state.countAfter}</h5>
                        <h5>top: {this.state.top}</h5>
                        <h5>left: {this.state.left}</h5>
                        <h5>bottom: {this.state.bottom}</h5>
                        <h5>right: {this.state.right}</h5>
                    </div>
                }

            </div>
        );
    }
});