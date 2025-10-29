var API_URL = 'https://fund.pescms.com';

var storageApi = {
	getAll: function () {
		return new Promise(function (resolve) {
			chrome.storage.local.get(null, resolve);
		});
	},
	get: function (key) {
		return new Promise(function (resolve) {
			chrome.storage.local.get([key], function (data) {
				resolve(data[key]);
			});
		});
	},
	set: function (key, value) {
		return new Promise(function (resolve) {
			var payload = {};
			payload[key] = value;
			chrome.storage.local.set(payload, resolve);
		});
	},
	setBulk: function (values) {
		return new Promise(function (resolve) {
			var payload = {};
			for (var key in values) {
				if (!Object.prototype.hasOwnProperty.call(values, key)) {
					continue;
				}
				var entry = values[key];
				if (entry && typeof entry === 'object') {
					var clone = Array.isArray(entry) ? entry.slice() : Object.assign({}, entry);
					if (clone.code === key) {
						delete clone.code;
					}
					payload[key] = clone;
				} else {
					payload[key] = entry;
				}
			}
			chrome.storage.local.set(payload, resolve);
		});
	},
	remove: function (key) {
		return new Promise(function (resolve) {
			chrome.storage.local.remove(key, resolve);
		});
	}
};

var parseStorageRecord = function (value) {
	if (!value) {
		return null;
	}
	if (typeof value === 'string') {
		try {
			return JSON.parse(value);
		} catch (e) {
			console.error('Failed to parse storage record', e);
			return null;
		}
	}
	return value;
};

var collectFundRecords = async function () {
	var all = await storageApi.getAll();
	var list = [];
	for (var key in all) {
		if (isNumeric(key)) {
			var parsed = parseStorageRecord(all[key]);
			if (parsed) {
				parsed.code = key;
				list.push(parsed);
			}
		}
	}
	return { entries: list, raw: all };
};

/**
 * 验证是否为数字
 * @param n
 * @returns {boolean}
 */
function isNumeric(n) {

    return !isNaN(parseFloat(n)) && isFinite(n);
}

/**
 * 用于判断空，Undefined String Array Object
 */
function isBlank(str) {
    if (Object.prototype.toString.call(str) === '[object Undefined]') {//空
        return true
    } else if (
        Object.prototype.toString.call(str) === '[object String]' ||
        Object.prototype.toString.call(str) === '[object Array]') { //字条串或数组
        return str.length == 0 ? true : false
    } else if (Object.prototype.toString.call(str) === '[object Object]') {
        return JSON.stringify(str) == '{}' ? true : false
    } else {
        return true
    }

}

/**
 * 封装简易的AJAX请求函数
 * @param param
 * @param callback
 */
var $ajax = function(param, callback){
    var obj = {url: '', data: {'': ''}, type: 'POST', dataType: 'JSON', dialog: true};
    $.extend(obj, param);
    var d = dialog({title: '系统提示', zIndex: '9999999'});


    var data = new FormData();
    for(var i in obj.data){
        data.append(i, obj.data[i]);
    }
    var xhr = new XMLHttpRequest();
    xhr.open(obj.type, obj.url);
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
            switch (xhr.status){
                case 200:
                    if(obj.dataType == 'JSON'){
                        var data = JSON.parse(xhr.responseText);

                        if (obj.dialog == true) {
                            d.content(data.msg).showModal();
                            setTimeout(function () {
                                d.close();
                            }, 3000);
                        }
                    }else{
                        var data = xhr.responseText;
                    }
                    callback(data, d);
                    break;
                case 404:
                case 500:
                    try{
                        var data = JSON.parse(xhr.responseText);
                        var msg = data.msg;
                    }catch (e){
                        var msg = '系统请求出错,请刷新页面再试';
                    }
                    d.content(msg).showModal();
                    setTimeout(function () {
                        d.close();
                    }, 3000);
                    break;
            }
        }
    }
    xhr.setRequestHeader("x-requested-with", 'XMLHttpRequest');
    xhr.setRequestHeader("accept", 'application/json');
    xhr.send(data);


}

/**
 * 弹窗提醒
 * @param msg 提示信息
 * @private
 */
var _alert = function (msg) {
    var d = dialog({
        title : 'Tips',
        content : msg,
        id : '_alert'
    });
    d.showModal();
    setTimeout(function(){
        d.close().remove();
    }, 1500)

}

/**
 * 实时更新基金
 */
var refreshFund = async function (user) {
	var hour = moment().format('H');
	if ((parseInt(hour, 10) < 8 || parseInt(hour, 10) > 17) && user === false) {
		return false;
	}

	var data = await collectFundRecords();
	if (!data.entries.length) {
		return false;
	}

	var updates = {};
	await Promise.all(data.entries.map(async function (record) {
		try {
			var response = await fetch('http://fundgz.1234567.com.cn/js/' + record.code + '.js?rt=' + Date.now());
			if (!response.ok) {
				return;
			}
			var text = await response.text();
			var match = text.match(/[a-zA-Z_]+\((.*)\)/);
			if (!match || match.length < 2) {
				return;
			}
			var fund = JSON.parse(match[1]);
			updates[record.code] = Object.assign({}, record, {
				now: fund['gsz'],
				gztime: fund['gztime'],
				name: fund['name']
			});
		} catch (error) {
			console.error('获取' + record.code + ' 基金信息失败', error);
		}
	}));

	if (Object.keys(updates).length) {
		await storageApi.setBulk(updates);
	}

	return true;
}

/**
 * 更新单位净值
 * @param user
 * @returns {boolean}
 */
var refreshJingzhi = async function (user) {
	var hour = moment().format('H');
	if ((parseInt(hour, 10) > 9 && parseInt(hour, 10) < 19) && user === false) {
		return false;
	}

	var data = await collectFundRecords();
	if (!data.entries.length) {
		return false;
	}

	var updates = {};
	await Promise.all(data.entries.map(async function (record) {
		try {
			var response = await fetch('http://fund.eastmoney.com/f10/F10DataApi.aspx?type=lsjz&code=' + record.code + '&page=1&per=1&sdate=&edate=&rt=' + Date.now());
			if (!response.ok) {
				return;
			}
			var html = await response.text();
			var tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
			if (!tbodyMatch) {
				return;
			}
			var rowMatch = tbodyMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
			if (!rowMatch) {
				return;
			}
			var cells = Array.from(rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi));
			if (!cells.length) {
				return;
			}
			var jingzhiTime = cells[0] ? cells[0][1].replace(/<[^>]+>/g, '').trim() : '';
			var valueMatch = rowMatch[1].match(/class="tor bold">([\s\S]*?)<\/td>/i);
			var jingzhiValue = valueMatch ? valueMatch[1].replace(/<[^>]+>/g, '').trim() : '';
			if (!jingzhiValue && cells[1]) {
				jingzhiValue = cells[1][1].replace(/<[^>]+>/g, '').trim();
			}
			if (isBlank(jingzhiValue) || isBlank(jingzhiTime)) {
				return;
			}
			updates[record.code] = Object.assign({}, record, {
				jingzhi: jingzhiValue,
				jingzhi_time: jingzhiTime
			});
		} catch (error) {
			console.error('获取' + record.code + ' 基金单位净值失败', error);
		}
	}));

	if (Object.keys(updates).length) {
		await storageApi.setBulk(updates);
	}

	return true;
}

/**
 * 云备份
 * @param user 用户操作备份
 * @returns {boolean}
 */
var cloudBackUp = async function (user) {
	var apikey = await storageApi.get('apikey');
	if (isBlank(apikey)) {
		return true;
	}

	var data = await collectFundRecords();
	var bak = {};
	for (var i = 0; i < data.entries.length; i++) {
		var record = data.entries[i];
		var copy = Object.assign({}, record);
		delete copy.code;
		bak[record.code] = copy;
	}

	var param = {
		url: API_URL + '/Api/Backup/append/' + Math.random(),
		data: {
			apikey: apikey,
			backup: JSON.stringify(bak)
		},
		dialog: user
	};

	$ajax(param, function () {});
}