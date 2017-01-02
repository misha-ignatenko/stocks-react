IgnRegression = {};

IgnRegression.functions = {
    multiple_regression_gradient_descent: function (featureMartix, actualOutput, initialWeights, stepSize, tolerance, maxIter) {
        var _converged = false;
        var _weights = initialWeights;

        var _iter = 0;

        while (!_converged) {
            _iter++;
            var _predictions = IgnRegression.utilities.get_dot_product_arrayOfArrays_and_array(featureMartix, _weights);
            var _errors = IgnRegression.utilities.subtract_arrays(_predictions, actualOutput);

            var _gradientSumSquares = 0;
            _weights.forEach(function(weight, featureIndex) {
                var _derivative = 2 * IgnRegression.utilities.get_dot_product_two_arrays(
                        _errors,
                        IgnRegression.utilities.get_column_from_array_of_arrays(featureMartix, featureIndex)
                    );
                _gradientSumSquares += _derivative * _derivative;

                _weights[featureIndex] -= stepSize * _derivative;
            });

            var _gradientMagnitude = Math.sqrt(_gradientSumSquares);
            if (_gradientMagnitude < tolerance || _iter > maxIter) {
                _converged = true;
            }
        }

        return {
            weights: _weights,
            iter: _iter
        };
    }
    , multiple_regression_gradient_descent2: function (
        featureMartix,
        actualOutput,
        initialWeights,
        stepSize,
        tolerance,
        maxIter,
        goDownPerDayAtMinRating,
        goUpPerDayAtMaxRating,
        minRatingValue,
        maxRatingValue,
        cutoffValue,
        minPossibleWeight,
        maxPossibleWeight
    ) {

        var _converged = false;
        var _weights = initialWeights;

        var _iter = 0;

        while (!_converged) {
            _iter++;
            var _firstActualValue = actualOutput[0];
            var _alternativePredictions = [_firstActualValue];
            featureMartix.forEach(function(featureMatrixRow, index) {
                if (index > 0) {
                    var _weightedAvgRatingForDay = IgnRegression.utilities.get_dot_product_two_arrays(featureMatrixRow, _weights);
                    var _dayIncrease;
                    var _fractionOfMaxGoUp;
                    var _fractionOfMaxGoDown;
                    if (_weightedAvgRatingForDay >= cutoffValue) {
                        _fractionOfMaxGoUp = (_weightedAvgRatingForDay - cutoffValue) / (maxRatingValue - cutoffValue);
                        _dayIncrease = _fractionOfMaxGoUp * goUpPerDayAtMaxRating;
                    } else {
                        _fractionOfMaxGoDown = (cutoffValue - _weightedAvgRatingForDay) / (cutoffValue - minRatingValue);
                        _dayIncrease = _fractionOfMaxGoDown * goDownPerDayAtMinRating;
                    }
                    var _priceFromPreviousDay = _alternativePredictions[index - 1];
                    var _newPrice = _priceFromPreviousDay * (1 + _dayIncrease);
                    _alternativePredictions.push(_newPrice);
                }
            });

            var _errors = IgnRegression.utilities.subtract_arrays(_alternativePredictions, actualOutput);

            var _gradientSumSquares = 0;
            _weights.forEach(function(weight, featureIndex) {
                var _derivative = 2 * IgnRegression.utilities.get_dot_product_two_arrays(
                        _errors, IgnRegression.utilities.get_column_from_array_of_arrays(featureMartix, featureIndex)
                    );
                _gradientSumSquares += _derivative * _derivative;

                _weights[featureIndex] -= stepSize * _derivative;

                //break out of method before reaching positive or negative infinities
                if (_weights[featureIndex] < minPossibleWeight || _weights[featureIndex] > maxPossibleWeight) {
                    _converged = true;
                }
            });

            var _gradientMagnitude = Math.sqrt(_gradientSumSquares);
            if (_gradientMagnitude < tolerance || _iter > maxIter) {
                _converged = true;
            }
        }

        return {
            weights: _weights,
            iter: _iter
        };
    }
};

IgnRegression.utilities = {
    //TODO fix these -- matrix is NOT actually a matrix, it is an array of arrays
    get_row_from_array_of_arrays: function(arrayOfArrays, rowIndex) {
        return arrayOfArrays[rowIndex];
    },
    get_column_from_array_of_arrays: function(arrayOfArrays, columnIndex) {
        var _result = [];
        for (var rowIndex = 0; rowIndex < arrayOfArrays.length; rowIndex++) {
            _result.push(arrayOfArrays[rowIndex][columnIndex]);
        }
        if (_result.length !== arrayOfArrays.length) {
            console.log("error getting column from array of arrays");
        }
        return _result;
    },

    remove_column_indices_from_matrix: function (matrix, arrayOfIndicesToRemove) {
        var _newFeatureMatrix = [];
        matrix.forEach(function (rowArr) {
            var _newRow = [];
            rowArr.forEach(function (rowColItem, colIndex) {
                if (arrayOfIndicesToRemove.indexOf(colIndex) === -1) {
                    _newRow.push(rowColItem);
                }
            });
            _newFeatureMatrix.push(_newRow);
        });
        return _newFeatureMatrix;
    },

    get_dot_product_two_arrays: function(array1, array2) {
        var _result = 0;
        if (array1.length === array2.length && array1.length > 0) {
            array1.forEach(function(arrayOneItem, index) {
                _result += (arrayOneItem * array2[index]);
            });
        } else {
            console.log("ARRAY LENGTHS NEED TO MATCH!");
        }
        return _result;
    },
    get_dot_product_arrayOfArrays_and_array: function(arrayOfArrays, array) {
        var _result = [];
        //make sure dimensions match
        var _resultLengthShouldBe = arrayOfArrays.length;
        var _allDimensionsMatch = true;
        for (var row = 0; row < arrayOfArrays.length; row++) {
            if (IgnRegression.utilities.get_row_from_array_of_arrays(arrayOfArrays, row).length !== array.length) {
                _allDimensionsMatch = false;
            }
        }
        if (!_allDimensionsMatch) {
            console.log("ERROR, not all dimensions match for matrix and array multiplication!");
        } else {
            arrayOfArrays.forEach(function(row) {
                _result.push(IgnRegression.utilities.get_dot_product_two_arrays(row, array))
            });
        }

        return _result;
    },
    subtract_matrices: function(matrix1, matrix2) {
        var _result = [];
        matrix1.forEach(function(matrixOneRowItem, row) {
            var _subtractedRow = [];
            matrixOneRowItem.forEach(function(matrixOneColumnItem, column) {
                _subtractedRow.push(
                    matrixOneColumnItem - matrix2[row][column]
                );
            });
            _result.push(_subtractedRow);
        });

        return _result;
    },
    subtract_arrays: function(array1, array2) {
        var _result = [];
        array1.forEach(function(item, index) {
            _result.push(
                item - array2[index]
            );
        });

        return _result;
    }
};