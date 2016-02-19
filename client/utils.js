if (!StocksReact) {
    StocksReact = {};
}
;

StocksReact.utilities = {
    getMinMaxFromArrOfObj(arrOfObj, key) {
        var _max = -1000000000.00;
        var _min = 1000000000.00;
        if (arrOfObj) {
            arrOfObj.forEach(function (obj) {
                var _val = parseFloat(obj[key]);
                if (_val > _max) {
                    _max = _val;
                }
                if (_val < _min) {
                    _min = _val;
                }
            });

            return [_min, _max];
        } else {
            return [];
        }
    }
};