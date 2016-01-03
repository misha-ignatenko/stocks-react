IgnRegression = {};

IgnRegression.functions = {
    multiple_regression_gradient_descent: function (featureMartix, actualOutput, initialWeights, stepSize, tolerance, maxIter) {

        return {};
    }
};

IgnRegression.utilities = {
    //TODO fix these -- matrix is NOT actually a matrix, it is an array of arrays
    get_row_from_matrix: function(matrix, rowIndex) {
        var _result = [];
        var _colIndex = 0;
        while (matrix[rowIndex][_colIndex]) {
            _result.push(matrix[rowIndex][_colIndex]);
            _colIndex++;
        }
        return _result;
    },
    get_column_from_matrix: function(matrix, columnIndex) {
        var _result = [];
        var _rowIndex = 0;
        while (matrix[_rowIndex][columnIndex]) {
            _result.push(matrix[_rowIndex][columnIndex]);
            _rowIndex++;
        }
        return _result;
    },
    get_dot_product: function(array1, array2) {
        var _result = 0;
        if (array1.length === array2.length && array1.length > 0) {
            array1.forEach(function(arrayOneItem, index) {
                _result += (arrayOneItem * array2[index]);
            });
        } else {
            console.log("ARRAY LENGTHS NEED TO MATCH!");
        }
        return _result;
    }
};