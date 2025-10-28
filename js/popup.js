var parseQuery = function () {
    var params = {};
    document.location.search.replace(/\??(?:([^=]+)=([^&]*)&?)/g, function () {
        function decode(s) {
            return decodeURIComponent(s.split("+").join(" "));
        }

        params[decode(arguments[1])] = decode(arguments[2]);
    });
    return params;
};

var loadPreviewData = async function () {
    var previewRaw = await storageApi.get('preview');
    if (!previewRaw) {
        return {};
    }
    if (typeof previewRaw === 'string') {
        try {
            return JSON.parse(previewRaw);
        } catch (error) {
            console.error('解析预览数据失败', error);
            return {};
        }
    }
    return previewRaw;
};

var buildFundRows = function (items) {
    $('.fund_list').remove();
    var total = 0;
    var totalJingzhi = 0;
    var rows = '';
	var hasEntries = false;
	for (var i = 0; i < items.length; i++) {
		var item = items[i];
		var light = '';
        var nowValue = parseFloat(item.now);
        var sellValue = parseFloat(item.sell);
        var addingValue = parseFloat(item.adding);
        if (!isNaN(nowValue) && !isNaN(sellValue) && nowValue >= sellValue) {
            light = 'am-danger';
        } else if (!isNaN(nowValue) && !isNaN(addingValue) && addingValue >= nowValue) {
            light = 'am-success';
        }

        var fene = isBlank(item.fene) ? '' : parseFloat(item.fene);
        var jingzhi = isBlank(item.jingzhi) ? '' : parseFloat(item.jingzhi);
        var jingzhiTime = isBlank(item.jingzhi_time) ? '' : '( ' + item.jingzhi_time + ' )';
		var yingkui = '-';
		var yingkuiClass = '';
		if (fene !== '' && !isBlank(item.now)) {
			var yingkuiRaw = fene * parseFloat(item.now) - item.buy * fene;
			yingkui = yingkuiRaw.toFixed(2);
			total += yingkuiRaw;
			yingkuiClass = yingkuiRaw > 0 ? 'profit-positive' : (yingkuiRaw < 0 ? 'profit-negative' : '');
		}

		var yingkuiJingzhi = '-';
		var yingkuiJingzhiClass = '';
		if (fene !== '' && jingzhi !== '') {
			var jingzhiRaw = fene * parseFloat(jingzhi) - item.buy * fene;
			yingkuiJingzhi = jingzhiRaw.toFixed(2);
			totalJingzhi += jingzhiRaw;
			yingkuiJingzhiClass = jingzhiRaw > 0 ? 'profit-positive' : (jingzhiRaw < 0 ? 'profit-negative' : '');
		}

        var notice = isBlank(item.notice) ? '' : parseInt(item.notice, 10);
        var noticeIcon = '';
        switch (notice) {
            case 2:
                noticeIcon = 'am-icon-pause';
                break;
            case 4:
                noticeIcon = 'am-icon-line-chart';
                break;
            case 6:
                noticeIcon = 'am-icon-sort-amount-desc';
                break;
            default:
                noticeIcon = '';
        }
		var fundName = item.name || '--';
		var noticeMarkup = noticeIcon ? '<i class="fund-notice-icon ' + noticeIcon + '"></i>' : '';

		rows += '' +
			'<tr class="fund_list ' + item.code + ' ' + light + ' ">' +
				'<td class="am-text-middle fund-name-column">' +
					'<div class="fund-name-cell">' +
						'<label class="fund-checkbox"><input name="notice[]" type="checkbox" value="' + item.code + '"></label>' +
						'<div class="fund-name-meta">' +
							'<span class="fund-name-text">' + fundName + '</span>' + noticeMarkup +
						'</div>' +
					'</div>' +
				'</td>' +
				'<td class="am-text-middle code-cell" title="' + fundName + '">' + item.code + ' <i class="view-fund am-icon-external-link" data="' + item.code + '"></i></td>' +
				'<td class="am-text-middle numeric-cell"><input type="text" class="am-text-center input-size" value="' + item.buy + '"  placeholder-text="购入价格"  name="buy" /></td>' +
				'<td class="am-text-middle numeric-cell">' +
				'<input type="text" class="am-text-center input-size" value="' + item.adding + '"  placeholder-text="补仓价格提醒" name="adding" />' +
				'</td>' +
				'<td class="am-text-middle numeric-cell">' +
				'<input type="text" class="am-text-center input-size" value="' + item.sell + '"  placeholder-text="卖出价格提醒" name="sell" />' +
				'</td>' +
				'<td class="am-text-middle numeric-cell">' +
				'<input type="text" class="am-text-center input-size" value="' + (fene === '' ? '' : fene) + '" placeholder-text="持有份额" name="fene" />' +
				'</td>' +
				'<td class="am-text-middle numeric-cell numeric-readout" title="最后更新时间: ' + (item.gztime || '') + '">' + (isBlank(item.now) ? '-' : item.now) + '</td>' +
				'<td class="am-text-middle numeric-cell numeric-readout ' + yingkuiClass + '">' + yingkui + '</td>' +
				'<td class="am-text-middle am-show-lg-only numeric-cell numeric-readout">' + (jingzhi === '' ? '-' : jingzhi) + '<span class="am-text-xs am-block">' + jingzhiTime + '</span></td>' +
				'<td class="am-text-middle am-show-lg-only numeric-cell numeric-readout ' + yingkuiJingzhiClass + '">' + yingkuiJingzhi + '</td>' +
				'<td class="am-text-middle"><div class="fund-actions">' +
				'<span class="am-btn am-btn-xs am-btn-primary" data="' + item.code + '"><i class="am-icon-pencil"></i> 修改</span>' +
				'<span class="am-btn am-btn-xs am-btn-warning fund-analyze" data="' + item.code + '"><i class="am-icon-line-chart"></i> 分析</span>' +
				'<span class="am-btn am-btn-xs am-btn-danger am-show-lg-only" data="' + item.code + '"><i class="am-icon-trash"></i> 删除</span>' +
				'</div></td>' +
			'</tr>';
		hasEntries = true;
    }

    $('#add').after(rows);
	var totalClass = total > 0 ? 'profit-positive' : (total < 0 ? 'profit-negative' : '');
	var totalJingzhiClass = totalJingzhi > 0 ? 'profit-positive' : (totalJingzhi < 0 ? 'profit-negative' : '');
	$('.total').removeClass('profit-positive profit-negative').addClass(totalClass).html(total.toFixed(2));
	$('.total_jingzhi').removeClass('profit-positive profit-negative').addClass(totalJingzhiClass).html(totalJingzhi.toFixed(2));
	if (hasEntries) {
		$('.summary-row').css('display', 'table-row');
		$('.empty-state').hide();
	} else {
		$('.summary-row').css('display', 'none');
		$('.empty-state').text('暂无基金持仓，点击上方新增条目，开启你的组合管理。').show();
	}

	$('input[name="notice[]"]').off('change').on('change', function () {
		var checked = $(this).is(':checked');
		$(this).closest('tr').toggleClass('is-selected', checked);
	});

	$('input[name="notice[]"]:checked').each(function () {
		$(this).closest('tr').addClass('is-selected');
	});
};

var renderList = async function () {
    var params = parseQuery();
    var isPreview = params['preview'] === 'true';
    var items = [];

    if (isPreview) {
        var preview = await loadPreviewData();
        for (var key in preview) {
            if (isNumeric(key)) {
                var entry = Object.assign({ code: key }, preview[key]);
                items.push(entry);
            }
        }
    } else {
        var data = await collectFundRecords();
        items = data.entries.slice();
    }

    items.sort(function (a, b) {
        return a.code.localeCompare(b.code);
    });

    buildFundRows(items);

    if (isPreview) {
        $('input').attr('disabled', 'disabled');
        $('.am-btn').remove();
        var tableStr = $('table').clone();
        $('.am-padding').html(tableStr);
        $('table').before('<p>备份ID: <strong>' + (params['restore'] || '') + '</strong></p>');
    }
};

$(function () {
    chrome.action.setBadgeText({ text: '' });

	$('#add .am-btn-success').on('click', async function () {
        var inputContent = $('#add input').serializeArray();
        var item = {
            now: '',
            gztime: '',
            fene: '',
            name: ''
        };

        for (var i = 0; i < inputContent.length; i++) {
            var value = inputContent[i]['value'];
            var msg = $('input[name=' + inputContent[i]['name'] + ']').attr('placeholder-text');

            if (isBlank(value)) {
                _alert('请输入' + msg);
                return false;
            }

            if (isNumeric(value) === false) {
                _alert(msg + '仅限输入数字');
                return false;
            }

            item[inputContent[i]['name']] = inputContent[i]['value'];
        }

		var code = inputContent[0]['value'];
		await storageApi.set(code, item);
		await refreshFund(true);
        $('#add input').val('');
        _alert('新增基金成功');
        await renderList();
        await cloudBackUp(false);
    });

    $('body').on('click', '.am-btn-primary', async function () {
        var code = $(this).attr('data');
        var inputDom = $(this).closest('tr').find('input');
        var inputContent = inputDom.serializeArray();
        var fund = await storageApi.get(code);
        fund = parseStorageRecord(fund) || {};

        for (var i = 0; i < inputContent.length; i++) {
            var value = inputContent[i]['value'];
            var msg = $('input[name=' + inputContent[i]['name'] + ']').attr('placeholder-text');
            if (isBlank(value)) {
                _alert('请输入' + msg);
                return false;
            }

            if (isNumeric(value) === false) {
                _alert(msg + '仅限输入数字');
                return false;
            }
            fund[inputContent[i]['name']] = inputContent[i]['value'];
        }

        await storageApi.set(code, fund);
        _alert('修改 ' + code + ' 基金成功');
        inputDom.addClass('am-text-primary');
        await cloudBackUp(false);
        setTimeout(function () {
            renderList();
        }, 2500);
    });

    $('.update-notice').on('click', async function () {
        var noticeType = $('select[name=notice_type]').val();
        if (noticeType === '') {
            alert('请选择要更改通知的设置类型');
            return false;
        }
        var updated = false;
        var tasks = [];
        $("input[name='notice[]']:checked").each(function () {
            var code = $(this).val();
            tasks.push((async function () {
                var fund = await storageApi.get(code);
                fund = parseStorageRecord(fund);
                if (fund) {
                    fund['notice'] = noticeType;
                    await storageApi.set(code, fund);
                    updated = true;
                }
            })());
        });
        await Promise.all(tasks);

        if (updated) {
            var d = dialog({
                title: 'Tips',
                content: '更改设置完成!'
            });
            d.showModal();
            await cloudBackUp(false);
            setTimeout(function () {
                d.close().remove();
                $('.checkbox-all').prop('checked', false);
                renderList();
            }, 1500);
        }
    });

    $('body').on('click', '.am-btn-danger', async function () {
        var id = $(this).attr('data');
        if (confirm('您确定要删除 ' + id + ' 基金吗？')) {
            await storageApi.remove(id);
            await renderList();
            await cloudBackUp(false);
        }
    });

    $('body').on('click', '.fund-analyze', function () {
        var code = $(this).attr('data');
        chrome.tabs.create({ url: API_URL + '/fund/analyze/' + code + '.html' });
    });

    $('body').on('click', '.view-fund', function () {
        var code = $(this).attr('data');
        chrome.tabs.create({ url: 'http://fund.eastmoney.com/' + code + '.html' });
    });

    $('.document').on('click', function () {
        chrome.tabs.create({ url: 'https://www.pescms.com/d/v/32/84.html' });
    });

    $('.zan').on('click', function () {
        var d = dialog({
            title: '打赏给本扩展',
            content: $('.zan-img')[0],
            padding: 0
        });
        d.showModal();
    });

    $('.refresh').on('click', async function () {
        var d = dialog({
            title: '刷新中...',
            id: 'refresh_fund'
        }).showModal();

        await refreshFund(true);
        await refreshJingzhi(true);
        setTimeout(async function () {
            await renderList();
            d.close().remove();
        }, 2000);
    });

    $('.popup').on('click', function () {
        chrome.tabs.create({ url: 'popup.html' });
    });

    $('.fund-source').on('click', function () {
        chrome.tabs.create({ url: 'http://fund.eastmoney.com/' });
    });

    $('.bak').on('click', function () {
        chrome.tabs.create({ url: 'bak.html' });
    });

    $('.checkbox-all').on('click', function () {
        var checked = $(this).prop('checked');
		$("input[name='notice[]']").prop('checked', checked).trigger('change');
    });

    var init = async function () {
        await renderList();
        var helpDialogFlag = await storageApi.get('help_dialog');
        if (helpDialogFlag) {
            return;
        }

        var helpDialog2 = dialog({
            align: 'right',
            content: '列表可以看到详尽的内容',
            zIndex: 1
        });
        helpDialog2.show($('.popup')[0]);

        var helpDialogZan = dialog({
            align: 'bottom',
            content: '若觉得本扩展有用，捐赠可以使它持续更新',
            zIndex: 1
        });

        setTimeout(function () {
            helpDialog2.close().remove();
            helpDialogZan.show($('.zan ')[0]);
        }, 5010);

        var helpDialog = dialog({
            title: '欢迎使用基金定投助手',
            align: 'bottom left',
            width: '350px',
            content: $('.help_content'),
            padding: 0,
            cancelDisplay: false,
            cancel: function () {
                storageApi.set('help_dialog', 1);
            }
        });
        setTimeout(function () {
            helpDialogZan.close().remove();
            helpDialog.show($('.document')[0]);
        }, 10010);
    };

    init();
});
﻿
