var restore_data = async function (json) {
    try {
        var parsed = JSON.parse(json);
        var all = await storageApi.getAll();
        var removeKeys = [];
        for (var key in all) {
            if (isNumeric(key)) {
                removeKeys.push(key);
            }
        }
        if (removeKeys.length) {
            await storageApi.remove(removeKeys);
        }
        var updates = {};
        for (var code in parsed) {
            if (isNumeric(code)) {
                updates[code] = parsed[code];
            }
        }
        if (Object.keys(updates).length) {
            await storageApi.setBulk(updates);
        }
        alert('数据还原成功!');
        window.location.reload();
    } catch (error) {
        alert('备份数据存在异常,程序无法解包');
        return false;
    }
};

$(function () {
    storageApi.set('preview', '').catch(function () {});

    $('.popup').on('click', function () {
        chrome.tabs.create({ url: 'popup.html' });
    });

    var printBakJson = async function () {
        var data = await collectFundRecords();
        var bak = {};
        for (var i = 0; i < data.entries.length; i++) {
            var entry = data.entries[i];
            var copy = Object.assign({}, entry);
            delete copy.code;
            bak[entry.code] = copy;
        }
        $('.am-pre-scrollable').html(JSON.stringify(bak));
    };
    printBakJson();

    $('.restore').on('click', async function () {
        if (!confirm('确认要还原数据?已有数据将被覆写!')) {
            return false;
        }

        var content = $('.restore-content').val();
        if (isBlank(content)) {
            alert('请输入您要还原的备份数据');
            return false;
        }

        await restore_data(content);
    });

    $('body').on('click', '.restore-api, .preview', async function () {
        var preview = $(this).hasClass('preview');
        var restore = $(this).attr('data');

        if (!preview) {
            if (!confirm('确认要还原数据?已有数据将被覆写!')) {
                return false;
            }
        }

        var apikey = await storageApi.get('apikey');
        if (isBlank(apikey)) {
            return true;
        }

        var param = {
            url: API_URL + '/Api/Backup/restore/' + Math.random(),
            data: {
                apikey: apikey,
                restore: $(this).attr('data'),
                method: 'GET'
            },
            dialog: false
        };
        $ajax(param, async function (content) {
            if (content.status == 200) {
                if (preview) {
                    await storageApi.set('preview', content['data'][0]['json']);
                    chrome.tabs.create({ url: 'popup.html?preview=true&restore=' + restore });
                } else {
                    await restore_data(content['data'][0]['json']);
                }
            }
        });
    });

    var loadApiKeyContent = async function () {
        var apikey = await storageApi.get('apikey');
        if (isBlank(apikey)) {
            return true;
        }
        $('.am-backup-hide').show();

        var param = {
            url: API_URL + '/Api/Backup/' + Math.random(),
            data: {
                apikey: apikey,
                method: 'GET'
            },
            dialog: false
        };

        $ajax(param, function (content) {
            var str = '';
            if (content.status == 200) {
                if (content.data.length === 0) {
                    str = '<li>暂无备份记录</li>';
                } else {
                    for (var i in content.data) {
                        var item = content.data[i];
                        str += '<li>' +
                            '<div class="backup-meta">' +
                            '<span class="backup-no">#' + item['no'] + '</span>' +
                            '<span class="backup-date">' + item['date'] + '</span>' +
                            '</div>' +
                            '<div class="backup-actions">' +
                            '<button type="button" class="am-btn list-btn am-btn-primary restore-api" data="' + item['no'] + '">还原</button>' +
                            '<button type="button" class="am-btn list-btn am-btn-danger delete-api" data="' + item['no'] + '">删除</button>' +
                            '<button type="button" class="am-btn list-btn am-btn-warning preview" data="' + item['no'] + '">预览</button>' +
                            '</div>' +
                            '</li>';
                    }
                }
            } else {
                str = '<li>' + content.msg + '</li>';
            }

            $('.backup-list').html(str);
        });

        $('.apikey').val(apikey);
    };
    loadApiKeyContent();

    $('.record-api').on('click', async function () {
        var apikey = $('.apikey').val();
        if (isBlank(apikey)) {
            alert('请输入API密钥');
            return false;
        }

        var param = {
            url: API_URL + '/Api/Backup/check/' + Math.random(),
            data: { apikey: apikey },
            dialog: false
        };

        $ajax(param, async function (data, d) {
            console.dir(data);
            var msg = data.status == 200 ? '接口APIKEY已更新' : data.msg;
            if (data.status == 200) {
                await storageApi.set('apikey', apikey);
            }
            d.content(msg).showModal();
            setTimeout(function () {
                d.close();
                window.location.reload();
            }, 3000);
        });
    });

    $('.signup').on('click', function () {
        chrome.tabs.create({ url: API_URL + '/login.html' });
    });

    $('body').on('click', '.delete-api', async function () {
        if (!confirm('确定要删除备份吗?')) {
            return false;
        }

        var apikey = await storageApi.get('apikey');
        var no = $(this).attr('data');
        var param = {
            url: API_URL + '/Api/Backup/' + Math.random(),
            data: {
                apikey: apikey,
                method: 'DELETE',
                no: no
            }
        };
        $ajax(param, function () {
            setTimeout(function () {
                window.location.reload();
            }, 2500);
        });
    });
});
