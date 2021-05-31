/**
 * 自动轮巡获取佛上市各个区域下的各个可接种疫苗的情况
 * 
 * https://fsservice.wjj.foshan.gov.cn/fw/content/wxOrder/index.html?state=ch5#/appoint/organizationlist?bookType=personal
 */


const fetch = require('node-fetch');
const notifier = require('node-notifier');


// =========================== 爬虫 START ===========================
const Crawler = (() => {
	// 区域街道
	const groupAreaMap = new Map([
		['蝉城区', ['石湾街道', '张槎街道', '祖庙街道', '南庄镇']],
		['南海区', ['桂城街道', '九江镇', '西樵镇', '丹灶镇', '狮山镇', '大沥镇', '里水镇']],
		['顺德区', ['大良街道', '容桂街道', '伦教街道', '勒流街道', '陈村镇', '均安镇', '杏坛镇', '龙江镇', '乐从镇', '北滘镇']],
		['三水区', ['西南街道', '云东海街道', '大塘镇', '乐平镇', '白坭镇', '芦苞镇', '南山镇']],
		['高明区', ['荷城街道', '杨和镇', '明城镇', '更合镇']],
	]);


	// 根据区域街道获取疫苗信息
	const getOrganizeByGroupArea = 'https://fsservice.wjj.foshan.gov.cn/fw2/foying/wechatpublic/wx/userBooking/getOrganizeByGroupArea'
	// 根据医院机构id，日期时间 获取疫苗排班列表
	const getScheduleFullForShow = 'https://fsservice.wjj.foshan.gov.cn/fw2/foying/wechatpublic/wx/userBooking/getScheduleFullForShow'
	// 根据医院机构id，日期时间 获取疫苗接种时间节点
	const getScheduleByDate = 'https://fsservice.wjj.foshan.gov.cn/fw2/foying/wechatpublic/wx/userBooking/getScheduleByDate';


	const httpRequest = (url, { method = 'POST', params }) =>
		new Promise((resolve, reject) => {
			fetch(url, {
				method,
			  headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(params),
			})
				.then(res => res.json())
				.then(res => {
					if (res.ResCode === '100') {
						return resolve(res);
					}
					return reject(res);
				})
				.catch(reject);
		})

	// 运行
	function run() {
		// 循环
		for (let [groupArea, groupStreetList] of groupAreaMap) {
		  for (let groupStreet of groupStreetList) {
		  	httpRequest(getOrganizeByGroupArea, {
		  		params: {
			    	groupArea,
			    	groupStreet,
		    	},
		  	})
		  		.then(res => {
		  			// 遍历所有医院看是否无号
		  			res.entityList
			  			.forEach(row => printOrganize({
			  				...row,
					    	groupArea,
					    	groupStreet,
			  			}));

		  			// 查看是否有排班的接种点
						res.entityList
		  				// .filter(({ showFlag }) => showFlag !== '0') // 排除无号的
							.forEach(row => getScheduleFull({
								...row, 
					    	groupArea,
					    	groupStreet,
					    }));

						// 查看排班的接种点时间
						res.entityList
		  				// .filter(({ showFlag }) => showFlag !== '0') // 排除无号的
							.forEach(row => getSchedule({
								...row, 
					    	groupArea,
					    	groupStreet,
					    }));
		    	})
		    	.catch(err => {
		    		console.error('获取接种门诊异常', err);
		    	});
		  }
		}
	}

	// 打印机构信息
	function printOrganize({
		id, // 疫苗接种点机构ID
		organizeName, // 疫苗接种点名称
		showFlag, // 是否有号： 0(无)
		groupArea,
		groupStreet,
	}) {
		const showFlagLabel = showFlag === '0' ? '无号' : '有号';
	  console.log(`${groupArea} - ${groupStreet} - ${organizeName} ${showFlagLabel}`);
	}

	// 未来几天日期
	function recentlyDate(fetureDays = 6) {
		// 补零
		const appendZero = n => `0${n}`.slice(-2);
		// 今天
		const today = new Date();
		const [y, m, d] = [today.getFullYear(), appendZero(today.getMonth() + 1), appendZero(today.getDate())];
		const ret = [`${y}-${m}-${d}`];
		// 获取未来几天
		for (let i = 1; i <= fetureDays; i++) {
			const day = new Date(today.getTime());
			day.setDate(day.getDate() + i);
			const [nextY, nextM, nextD] = [day.getFullYear(), appendZero(day.getMonth() + 1), appendZero(day.getDate())];
			ret.push(`${nextY}-${nextM}-${nextD}`);
		}
		return ret;
	}

	// 获取排班详情
	function getScheduleFull({
		id,
  	groupArea,
  	groupStreet,
	}) {
		httpRequest(getScheduleFullForShow, {
			params: {
				baseOrganizeID: id,
				// 最近一周时间
				date: recentlyDate().join(',')
			}
		})
			.then((res) => {
				console.log(`${groupArea} - ${groupStreet} 有排班`);
			})
			.catch((err) => {
				console.log('获取排班出现异常', err);
			});
	}

	// 获取排班时间
	function getSchedule({
			id: baseOrganizeID, // 机构id
			organizeName, // 机构名称
			groupArea,
			groupStreet,
		}) {
		recentlyDate()
			.forEach((scheduleDate) => {
				httpRequest(getScheduleByDate, {
					params: {
						baseOrganizeID,
						scheduleDate,
					},
				})
					.then(res => {
						console.log(`${groupArea} - ${groupStreet} 有排班`);
						// 获取有剩余的疫苗
						const haveVaccin = res.entityList.filter(({ count }) => count > 0);
						// 测试数据
						// haveVaccin.push({
						// 	beginTimeStr: '14:30:00',
						// 	count: 2,
						// 	endTimeStr: '15:30:00',
						// 	scheduleID: '7d238ec7f7814486b9ca2a0fdb93f3e41622381209157',
						// 	vaccineProducer: '北京科兴'
						// })
						if (haveVaccin.length) {
							// 企业微信机器人发通知
							// rebotNotify();
							notifier.notify({
							  title: `${groupArea} - ${groupStreet} 有疫苗可预约啦`,
							  message: haveVaccin.map(({
							  	beginTimeStr,
							  	endTimeStr,
							  	count,
							  	vaccineProducer,
							  }) => `${beginTimeStr} - ${endTimeStr} 剩余 ${count} 剂疫苗 - ${vaccineProducer}`).join('\n'),
							  sound: true,
							});
						}
					})
					.catch(err => {
						// console.log(`获取 ${scheduleDate} 排班时间出现异常`, err);
					});
			});
	}

	return {
		run,
	};
})();
// =========================== 爬虫 START ===========================



// =========================== 企业微信机器人 START ===========================
const WechatRobot = (() => {
	const ROBOT_KEY = '668191e4-43be-43b9-b791-edd7ae1b2278'; // 追梦赤子心 - 全员群
  // const ROBOT_KEY = 'd9323df8-930e-467b-9253-4db62f2dd1aa'; // 追梦赤子心 - 技术部

	/**
	 * 发送消息
	 */
	function send(data) {
		return fetch(`https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${ROBOT_KEY}`, {
			method: 'POST',
			data,
		})
			.then(res => res.json());
	}

	function sendMarkdownMsg(content) {
		return send({
			msgtype: 'markdown',
			agentid: 1,
			markdown: {
				content,
			},
		});
	}

	return {
		sendMarkdownMsg,
	};
})();
// =========================== 企业微信机器人 END   ===========================


// 循环去抓取
const minutes = (n = 3) => n * 60 * 60 * 1000;
setInterval(() => {
	console.log(new Date().toLocaleTimeString());
	Crawler.run();
}, minutes());


// WechatRobot.sendMarkdownMsg(`企业微信改版了，需要相关信息，需要管理员登录进去后台才行。`)
// 	.then(res => {
// 		console.log('发送情况', res);
// 	});
