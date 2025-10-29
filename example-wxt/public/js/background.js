const FUND_CODE_REGEX = /^\d+$/;

const storage = {
	async getAll() {
		return new Promise((resolve) => {
			chrome.storage.local.get(null, resolve);
		});
	},
	async get(key) {
		return new Promise((resolve) => {
			chrome.storage.local.get([key], (data) => resolve(data[key]));
		});
	},
	async set(key, value) {
		return new Promise((resolve) => {
		let storedValue = value;
		if (value && typeof value === 'object') {
			storedValue = Array.isArray(value) ? value.slice() : { ...value };
			if (storedValue.code === key) {
				delete storedValue.code;
			}
		}
		chrome.storage.local.set({ [key]: storedValue }, resolve);
		});
	},
	async setBulk(values) {
		return new Promise((resolve) => {
		const payload = {};
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
		chrome.storage.local.set(payload, resolve);
		});
	}
};

const isNumeric = (n) => !isNaN(parseFloat(n)) && isFinite(n);

const isBlank = (value) => {
	if (value === undefined || value === null) {
		return true;
	}
	if (typeof value === 'string' || Array.isArray(value)) {
		return value.length === 0;
	}
	if (typeof value === 'object') {
		return Object.keys(value).length === 0;
	}
	return false;
};

const toDateString = (date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

const parseStoredRecord = (value) => {
	if (!value) {
		return null;
	}
	if (typeof value === 'string') {
		try {
			return JSON.parse(value);
		} catch (error) {
			console.error('Failed to parse stored record', error);
			return null;
		}
	}
	return value;
};

const collectFundRecords = async () => {
	const all = await storage.getAll();
	const entries = [];
	for (const [key, value] of Object.entries(all)) {
		if (FUND_CODE_REGEX.test(key)) {
			const record = parseStoredRecord(value);
			if (record) {
				record.code = key;
				entries.push(record);
			}
		}
	}
	return { entries, raw: all };
};

const refreshFund = async (userTriggered) => {
	const now = new Date();
	const hour = now.getHours();
	if (!userTriggered && (hour < 8 || hour > 17)) {
		return;
	}

	const { entries } = await collectFundRecords();
	if (!entries.length) {
		return;
	}

	const updates = {};
	await Promise.all(entries.map(async (record) => {
		try {
			const response = await fetch(`http://fundgz.1234567.com.cn/js/${record.code}.js?rt=${Date.now()}`);
			if (!response.ok) {
				return;
			}
			const text = await response.text();
			const match = text.match(/[a-zA-Z_]+\((.*)\)/);
			if (!match || match.length < 2) {
				return;
			}
	const fund = JSON.parse(match[1]);
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
		}
	}));

	if (Object.keys(updates).length) {
		await storage.setBulk(updates);
	}
};

const extractText = (html) => html.replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').trim();

const parseJingzhiResponse = (html) => {
	const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
	if (!tbodyMatch) {
		return null;
	}
	const rowMatch = tbodyMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
	if (!rowMatch) {
		return null;
	}
	const cells = Array.from(rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi));
	if (!cells.length) {
		return null;
	}
	const dateText = extractText(cells[0][1] || '');
	let valueText = '';
	const valueMatch = rowMatch[1].match(/class="tor bold">([\s\S]*?)<\/td>/i);
	if (valueMatch) {
		valueText = extractText(valueMatch[1]);
	} else if (cells[1]) {
		valueText = extractText(cells[1][1] || '');
	}
	return {
		jingzhi: valueText,
		jingzhi_time: dateText
	};
};

const refreshJingzhi = async (userTriggered) => {
	const now = new Date();
	const hour = now.getHours();
	if (!userTriggered && hour > 9 && hour < 19) {
		return;
	}

	const { entries } = await collectFundRecords();
	if (!entries.length) {
		return;
	}

	const updates = {};
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
		await storage.setBulk(updates);
	}
};

const notifications = async () => {
	const now = new Date();
	const day = now.getDay();
	if (day === 0 || day === 6) {
		return;
	}
	const minutes = now.getMinutes();
	if (now.getHours() !== 14 || minutes < 30) {
		return;
	}

	const { entries, raw } = await collectFundRecords();
	if (!entries.length) {
		return;
	}

	const dateKey = toDateString(now);
	const previousNoticeState = parseStoredRecord(raw.saveNotice) || {};
	const todayNoticeState = previousNoticeState[dateKey] ? { ...previousNoticeState[dateKey] } : {};

	let badgeCount = 0;

	for (const record of entries) {
		const notice = isBlank(record.notice) ? '' : parseInt(record.notice, 10);
		let message = `${record.name || ''} ${record.code}`.trim();
		let icon = '';
		let shouldNotify = false;

		const nowValue = parseFloat(record.now);
		const sellValue = parseFloat(record.sell);
		const addingValue = parseFloat(record.adding);

		if (!Number.isNaN(nowValue) && !Number.isNaN(sellValue) && nowValue >= sellValue && notice !== 2 && notice !== 4) {
			message += ' 基金涨幅已达到可卖出价格，请及时处理';
			icon = 'sell.png';
			shouldNotify = true;
		} else if (!Number.isNaN(nowValue) && !Number.isNaN(addingValue) && addingValue >= nowValue && notice !== 2 && notice !== 6) {
			message += ' 基金跌幅已达到补仓价格，请及时处理';
			icon = 'adding.png';
			shouldNotify = true;
		}

		if (!shouldNotify) {
			continue;
		}

		const previousCount = todayNoticeState[record.code];
		const shouldCreate = previousCount === undefined || previousCount % 10 === 0;
		const nextCount = previousCount === undefined ? 11 : previousCount + 1;
		todayNoticeState[record.code] = nextCount;

		if (shouldCreate) {
			chrome.notifications.create('', {
				type: 'basic',
				iconUrl: `img/${icon}`,
				title: '基金定投提醒',
				message
			});
			badgeCount += 1;
		}
	}

	if (badgeCount > 0) {
		chrome.action.setBadgeText({ text: String(badgeCount) });
	}

	if (Object.keys(todayNoticeState).length) {
		await storage.set('saveNotice', { [dateKey]: todayNoticeState });
	}
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	chrome.tabs.create({ url: 'popup.html' });
	sendResponse();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
	if (alarm.name !== 'fundAlarm') {
		return;
	}
	await refreshFund(false);
	await refreshJingzhi(false);
	await notifications();
});

chrome.runtime.onInstalled.addListener(() => {
	chrome.alarms.create('fundAlarm', { periodInMinutes: 1 });
	chrome.action.setBadgeText({ text: '' });
});

chrome.runtime.onStartup.addListener(() => {
	chrome.alarms.create('fundAlarm', { periodInMinutes: 1 });
});