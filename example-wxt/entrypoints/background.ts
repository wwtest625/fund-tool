const FUND_CODE_REGEX = /^\d+$/;

const fundStorage = {
	async getAll() {
		return new Promise((resolve) => {
			browser.storage.local.get(null, resolve);
		});
	},
	async get(key: string) {
		return new Promise((resolve) => {
			browser.storage.local.get([key], (data: any) => resolve(data[key]));
		});
	},
	async set(key: string, value: any) {
		return new Promise((resolve) => {
		let storedValue = value;
		if (value && typeof value === 'object') {
			storedValue = Array.isArray(value) ? value.slice() : { ...value };
			if (storedValue.code === key) {
				delete storedValue.code;
			}
		}
		browser.storage.local.set({ [key]: storedValue }, () => resolve(undefined));
		});
	},
	async setBulk(values: Record<string, any>) {
		return new Promise((resolve) => {
		const payload: Record<string, any> = {};
		for (const [key, value] of Object.entries(values)) {
			if (value && typeof value === 'object') {
				const clone = Array.isArray(value) ? value.slice() : { ...value };
				if (clone.code === key) {
					delete clone.code;
				}
				payload[key] = clone;
			} else {
				payload[key] = value;
			}
		}
		browser.storage.local.set(payload, () => resolve(undefined));
		});
	}
};

const isNumeric = (n: any) => !isNaN(parseFloat(n)) && isFinite(n);

const isBlank = (value: any) => {
	if (value === undefined || value === null) {
		return true;
	}
	if (typeof value === 'string') {
		return value.trim() === '';
	}
	return false;
};

const collectFundRecords = async () => {
	const data = await fundStorage.getAll() as Record<string, any>;
	const entries: any[] = [];
	for (const [key, value] of Object.entries(data)) {
		if (FUND_CODE_REGEX.test(key)) {
			entries.push({ code: key, ...value });
		}
	}
	return { entries };
};

const refreshFund = async (userTriggered: boolean) => {
	const now = new Date();
	const hour = now.getHours();
	if (!userTriggered && (hour < 8 || hour > 17)) {
		return;
	}

	const { entries } = await collectFundRecords();
	if (!entries.length) {
		return;
	}

	const updates: Record<string, any> = {};
	await Promise.all(entries.map(async (record) => {
		try {
			const response = await fetch(`http://fundgz.1234567.com.cn/js/${record.code}.js?rt=${Date.now()}`);
			if (!response.ok) {
				return;
			}
			const text = await response.text();

			// 检查响应内容是否为空或无效
			if (!text || text.trim().length === 0) {
				console.warn(`基金 ${record.code} 返回空响应`);
				return;
			}

			const match = text.match(/[a-zA-Z_]+\((.*)\)/);
			if (!match || match.length < 2) {
				console.warn(`基金 ${record.code} 响应格式异常: ${text.substring(0, 100)}`);
				return;
			}

			// 验证JSON内容是否有效
			const jsonStr = match[1].trim();
			if (!jsonStr || jsonStr === '') {
				console.warn(`基金 ${record.code} JSON内容为空`);
				return;
			}

	const fund = JSON.parse(jsonStr);
	const updatedRecord = {
		...record,
		now: fund.gsz,
		gztime: fund.gztime,
		name: fund.name
	};
	const { code, ...stored } = updatedRecord;
	updates[record.code] = stored;
		} catch (error) {
			console.error('Failed to refresh fund', record.code, error);
			// 记录更详细的错误信息用于调试
			if (error instanceof SyntaxError) {
				console.error(`基金 ${record.code} JSON解析错误，可能是API返回格式异常`);
			}
		}
	}));

	if (Object.keys(updates).length) {
		await fundStorage.setBulk(updates);
	}
};

const parseJingzhiResponse = (html: string) => {
	const regex = /var apidata=\s*{[^}]*records:\s*\[([^\]]*)\]/;
	const match = html.match(regex);
	if (!match || match.length < 2) {
		return null;
	}

	const recordsStr = match[1];
	const recordMatch = recordsStr.match(/\[([^\]]+)\]/);
	if (!recordMatch || recordMatch.length < 2) {
		return null;
	}

	const values = recordMatch[1].split(',').map(s => s.replace(/"/g, '').trim());
	if (values.length < 2) {
		return null;
	}

	return {
		jingzhi_time: values[0],
		jingzhi: values[1]
	};
};

const refreshJingzhi = async (userTriggered: boolean) => {
	const now = new Date();
	const hour = now.getHours();
	if (!userTriggered && (hour < 8 || hour > 17)) {
		return;
	}

	const { entries } = await collectFundRecords();
	if (!entries.length) {
		return;
	}

	const updates: Record<string, any> = {};
	await Promise.all(entries.map(async (record) => {
		try {
			const response = await fetch(`http://fund.eastmoney.com/f10/F10DataApi.aspx?type=lsjz&code=${record.code}&page=1&per=1&sdate=&edate=&rt=${Date.now()}`);
			if (!response.ok) {
				return;
			}
			const html = await response.text();
	const parsed = parseJingzhiResponse(html);
			if (!parsed || isBlank(parsed.jingzhi)) {
				return;
			}
		const updatedRecord = {
			...record,
			jingzhi: parsed.jingzhi,
			jingzhi_time: parsed.jingzhi_time
		};
		const { code, ...stored } = updatedRecord;
		updates[record.code] = stored;
		} catch (error) {
			console.error('Failed to refresh jingzhi', record.code, error);
		}
	}));

	if (Object.keys(updates).length) {
		await fundStorage.setBulk(updates);
	}
};

const notifications = async () => {
	const { entries } = await collectFundRecords();
	if (!entries.length) {
		return;
	}

	const dateKey = new Date().toISOString().split('T')[0];
	const noticeData = await fundStorage.get('saveNotice') as any;
	const todayNoticeState = noticeData?.[dateKey] || {};
	let badgeCount = 0;

	for (const record of entries) {
		if (isBlank(record.now) || isBlank(record.fene)) {
			continue;
		}

		// 检查通知设置
		const notice = isBlank(record.notice) ? '' : parseInt(record.notice, 10);

		const currentPrice = parseFloat(record.now);
		const targetPrice = parseFloat(record.fene);
		const priceDiff = currentPrice - targetPrice;
		const percentDiff = Math.abs(priceDiff / targetPrice) * 100;

		let shouldNotify = false;
		let message = '';
		let icon = 'icon.png';

		// 卖出通知：当涨幅达到3%且未暂停所有通知(2)和卖出通知(4)时
		if (priceDiff > 0 && percentDiff >= 3 && notice !== 2 && notice !== 4) {
			shouldNotify = true;
			message = `${record.name || record.code} 当前净值 ${currentPrice}，已超过目标价格 ${targetPrice}，涨幅 ${percentDiff.toFixed(2)}%，建议卖出`;
			icon = 'sell.png';
		}
		// 补仓通知：当跌幅达到3%且未暂停所有通知(2)和补仓通知(6)时
		else if (priceDiff < 0 && percentDiff >= 3 && notice !== 2 && notice !== 6) {
			shouldNotify = true;
			message = `${record.name || record.code} 当前净值 ${currentPrice}，已低于目标价格 ${targetPrice}，跌幅 ${percentDiff.toFixed(2)}%，建议买入`;
			icon = 'adding.png';
		}

		if (!shouldNotify) {
			continue;
		}

		const previousCount = todayNoticeState[record.code];
		const shouldCreate = previousCount === undefined || previousCount % 10 === 0;
		const nextCount = previousCount === undefined ? 11 : previousCount + 1;
		todayNoticeState[record.code] = nextCount;

		if (shouldCreate) {
			browser.notifications.create('', {
				type: 'basic',
				iconUrl: `img/${icon}`,
				title: '基金定投提醒',
				message
			});
			badgeCount += 1;
		}
	}

	if (badgeCount > 0) {
		browser.action.setBadgeText({ text: String(badgeCount) });
	}

	if (Object.keys(todayNoticeState).length) {
		await fundStorage.set('saveNotice', { [dateKey]: todayNoticeState });
	}
};

export default defineBackground(() => {
	console.log('Hello background!', { id: browser.runtime.id });

	browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
		browser.tabs.create({ url: 'popup.html' });
		sendResponse();
	});

	browser.alarms.onAlarm.addListener(async (alarm) => {
		if (alarm.name !== 'fundAlarm') {
			return;
		}
		await refreshFund(false);
		await refreshJingzhi(false);
		await notifications();
	});

	browser.runtime.onInstalled.addListener(() => {
		browser.alarms.create('fundAlarm', { periodInMinutes: 1 });
		browser.action.setBadgeText({ text: '' });
	});

	browser.runtime.onStartup.addListener(() => {
		browser.alarms.create('fundAlarm', { periodInMinutes: 1 });
	});
});
