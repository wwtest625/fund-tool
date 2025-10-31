     <template>
       <div class="fund-list-container">
         <!-- Header -->
         <t-card bordered shadow="hover" class="header-card">
           <template #title>
             <div class="header-title">
               <div>
                 <h1>我的基金</h1>
                 <small>跟随市场节奏的智能组合视图</small>
               </div>
             </div>
           </template>
           <template #actions>
             <t-space size="small">
               <t-button theme="primary" @click="refreshData">
                 <template #icon><refresh-icon /></template>
                 刷新
               </t-button>
               <t-button theme="default" variant="outline" @click="openHelp">
                 <template #icon><help-circle-icon /></template>
                 帮助文档
               </t-button>
               <t-button theme="default" variant="outline" @click="showDonation">
                 <template #icon><heart-icon /></template>
                 捐赠支持
               </t-button>
               <t-button theme="default" variant="outline" @click="openBackup">
                 <template #icon><cloud-upload-icon /></template>
                 云备份
               </t-button>
             </t-space>
           </template>
         </t-card>

         <!-- Notification Settings -->
         <t-card bordered shadow="hover" class="mt-4">
           <div class="notification-settings">
             <t-space>
               <t-select
                 v-model="noticeType"
                 placeholder="请选择通知设置"
                 style="width: 200px"
               >
                 <t-option value="1" label="开启所有通知" />
                 <t-option value="2" label="暂停所有通知" />
                 <t-option value="4" label="暂停卖出通知" />
                 <t-option value="6" label="暂停补仓通知" />
               </t-select>
               <t-button theme="success" size="small" @click="updateNotice">
                 <template #icon><setting-icon /></template>
                 更改设置
               </t-button>
             </t-space>
             <div class="notice-legend">
               <t-space>
                 <span><pause-circle-icon /> 暂停所有通知</span>
                 <span><chart-line-icon /> 暂停卖出通知</span>
                 <span><swap-icon /> 暂停补仓通知</span>
               </t-space>
             </div>
           </div>
         </t-card>

         <!-- Fund Table -->
         <t-card bordered shadow="hover" class="mt-4">
           <t-table
             :data="fundList"
             :columns="columns"
             row-key="code"
             :selected-row-keys="selectedRowKeys"
             @select-change="onSelectChange"
             :loading="loading"
             :empty="emptyText"
             stripe
             hover
           >
             <template #name="{ row }">
               <div class="fund-name-cell">
                 <span class="fund-name-text">{{ row.name || '--' }}</span>
                 <pause-circle-icon v-if="row.notice === '2'" class="notice-icon" />
                 <chart-line-icon v-if="row.notice === '4'" class="notice-icon" />
                 <swap-icon v-if="row.notice === '6'" class="notice-icon" />
               </div>
             </template>

             <template #code="{ row }">
               <t-space>
                 <span>{{ row.code }}</span>
                 <t-link theme="primary" @click="viewFund(row.code)" hover="color">
                   <view-module-icon />
                 </t-link>
               </t-space>
             </template>

             <template #buy="{ row }">
               <t-input-number
                 v-model="row.buy"
                 :min="0"
                 :decimal-places="4"
                 theme="normal"
                 size="small"
                 @change="updateFund(row)"
               />
             </template>

             <template #adding="{ row }">
               <t-input-number
                 v-model="row.adding"
                 :min="0"
                 :decimal-places="4"
                 theme="normal"
                 size="small"
                 @change="updateFund(row)"
               />
             </template>

             <template #sell="{ row }">
               <t-input-number
                 v-model="row.sell"
                 :min="0"
                 :decimal-places="4"
                 theme="normal"
                 size="small"
                 @change="updateFund(row)"
               />
             </template>

             <template #fene="{ row }">
               <t-input-number
                 v-model="row.fene"
                 :min="0"
                 :decimal-places="2"
                 theme="normal"
                 size="small"
                 @change="updateFund(row)"
               />
             </template>

             <template #now="{ row }">
               <span :class="getPriceClass(row)">
                 {{ formatPrice(row.now) }}
               </span>
             </template>

             <template #profit="{ row }">
               <span :class="getProfitClass(calculateProfit(row))">
                 {{ formatProfit(calculateProfit(row)) }}
               </span>
             </template>

             <template #jingzhi="{ row }">
               <div>
                 <div>{{ formatPrice(row.jingzhi) }}</div>
                 <small v-if="row.jingzhi_time" class="text-gray">
                   {{ row.jingzhi_time }}
                 </small>
               </div>
             </template>

             <template #holdProfit="{ row }">
               <span :class="getProfitClass(calculateHoldProfit(row))">
                 {{ formatProfit(calculateHoldProfit(row)) }}
               </span>
             </template>

             <template #action="{ row }">
               <t-space>
                 <t-link theme="danger" hover="color" @click="deleteFund(row.code)">
                   删除
                 </t-link>
               </t-space>
             </template>
           </t-table>

           <!-- Add Fund Row -->
           <div class="add-fund-section">
             <t-space :size="12" align="center">
               <div class="fund-code-input">
                 <t-input
                   v-model="newFund.code"
                   placeholder="基金代码"
                   style="width: 120px"
                   @blur="onFundCodeBlur"
                   :loading="codeLoading"
                 />
                 <div v-if="newFund.name" class="fund-name-preview">
                   {{ newFund.name }}
                 </div>
               </div>
               <t-input-number
                 v-model="newFund.buy"
                 placeholder="成本价"
                 :min="0"
                 :decimal-places="4"
                 style="width: 120px"
               />
               <t-input-number
                 v-model="newFund.adding"
                 placeholder="补仓价"
                 :min="0"
                 :decimal-places="4"
                 style="width: 120px"
               />
               <t-input-number
                 v-model="newFund.sell"
                 placeholder="卖出价"
                 :min="0"
                 :decimal-places="4"
                 style="width: 120px"
               />
               <t-input-number
                 v-model="newFund.fene"
                 placeholder="持有份额"
                 :min="0"
                 :decimal-places="2"
                 style="width: 120px"
               />
               <t-button theme="success" size="small" @click="addFund">
                 <template #icon><add-icon /></template>
                 新增
               </t-button>
             </t-space>
           </div>

           <!-- Summary -->
           <div class="summary-section">
             <t-space size="large">
               <div class="summary-item">
                 <span class="summary-label">估算合计：</span>
                 <span :class="getProfitClass(totalProfit)" class="summary-value">
                   {{ formatProfit(totalProfit) }}
                 </span>
               </div>
               <div class="summary-item">
                 <span class="summary-label">持有合计：</span>
                 <span :class="getProfitClass(totalHoldProfit)" class="summary-value">
                   {{ formatProfit(totalHoldProfit) }}
                 </span>
               </div>
             </t-space>
           </div>
         </t-card>

         <!-- Donation Dialog -->
         <t-dialog
           v-model:visible="donationVisible"
           header="捐赠支持"
           :footer="null"
           width="400px"
         >
           <div class="text-center">
             <p class="mb-4">感谢您对基金定投助手的支持，您的鼓励能帮助我们持续优化体验。</p>
             <div class="flex justify-center mb-4">
               <img src="/img/zan.jpg" alt="支付宝收款码" class="w-48 h-48 object-cover rounded-lg border border-gray-200" />
             </div>
             <p class="text-sm text-gray-500">扫码支持开发者</p>
           </div>
         </t-dialog>
       </div>
     </template>

     <script setup lang="ts">
     import { ref, computed, onMounted } from 'vue';
     import { MessagePlugin } from 'tdesign-vue-next';
     import {
       RefreshIcon,
       HelpCircleIcon,
       HeartIcon,
       CloudUploadIcon,
       SettingIcon,
       PauseCircleIcon,
       ChartLineIcon,
       SwapIcon,
       ViewModuleIcon,
       AddIcon
     } from 'tdesign-icons-vue-next';
     import { fetchFundInfo, fetchFundEstimate } from '../../lib/fund-service';

     interface FundItem {
       code: string;
       name?: string;
       buy: number | string;
       adding: number | string;
       sell: number | string;
       fene: number | string;
       now?: number | string;
       jingzhi?: number | string;
       jingzhi_time?: string;
       notice?: string;
     }

     const loading = ref(false);
     const codeLoading = ref(false);
     const fundList = ref<FundItem[]>([]);
     const selectedRowKeys = ref<string[]>([]);
     const noticeType = ref('');
     const donationVisible = ref(false);
     const emptyText = ref('暂无基金数据，点击上方新增基金，开启你的组合管理。');

     const newFund = ref({
       code: '',
       name: '',
       buy: 0,
       adding: 0,
       sell: 0,
       fene: 0
     });

     const columns = [
       { colKey: 'row-select', type: 'multiple', width: 50 },
       { colKey: 'name', title: '基金名称', width: 200 },
       { colKey: 'code', title: '基金代码', width: 120 },
       { colKey: 'buy', title: '成本价', width: 130 },
       { colKey: 'adding', title: '补仓价格提醒', width: 130 },
       { colKey: 'sell', title: '卖出价格提醒', width: 130 },
       { colKey: 'fene', title: '持有份额', width: 130 },
       { colKey: 'now', title: '最新价格', width: 120 },
       { colKey: 'profit', title: '盈亏估算', width: 120 },
       { colKey: 'jingzhi', title: '单位净值', width: 150 },
       { colKey: 'holdProfit', title: '持有收益', width: 120 },
       { colKey: 'action', title: '操作', width: 100, fixed: 'right' }
     ];

     const storageApi = {
       get: (key: string) => new Promise((resolve) => chrome.storage.local.get([key], (data) => resolve(data[key]))),
       set: (key: string, value: any) => new Promise((resolve) => chrome.storage.local.set({ [key]: value }, resolve)),
       getAll: () => new Promise((resolve) => chrome.storage.local.get(null, resolve)),
       remove: (key: string) => new Promise((resolve) => chrome.storage.local.remove(key, resolve))
     };

     const loadFunds = async () => {
       loading.value = true;
       try {
         const all: any = await storageApi.getAll();
         const list: FundItem[] = [];
         for (const key in all) {
           if (!isNaN(Number(key))) {
             const item = typeof all[key] === 'string' ? JSON.parse(all[key]) : all[key];
             if (item) {
               item.code = key;
               // 确保通知字段存在，默认为开启所有通知
               if (!item.notice) {
                 item.notice = '1';
               }
               list.push(item);
             }
           }
         }
         fundList.value = list.sort((a, b) => a.code.localeCompare(b.code));
       } catch (error) {
         console.error('加载基金数据失败:', error);
         MessagePlugin.error('加载基金数据失败');
       } finally {
         loading.value = false;
       }
     };

     /**
      * 基金代码输入失焦时自动获取基金信息
      */
     const onFundCodeBlur = async () => {
       const code = newFund.value.code.trim();
       if (!code || !/^\d{6}$/.test(code)) {
         return;
       }

       // 如果已经有名称了，不重复获取
       if (newFund.value.name) {
         return;
       }

       codeLoading.value = true;
       try {
         const fundInfo = await fetchFundInfo(code);
         newFund.value.name = fundInfo.profile.name || fundInfo.realtime.name || '';
         if (newFund.value.name) {
           MessagePlugin.success(`已获取基金信息：${newFund.value.name}`);
         }
       } catch (error) {
         console.error('获取基金信息失败:', error);
         MessagePlugin.warning('获取基金信息失败，请检查基金代码是否正确');
       } finally {
         codeLoading.value = false;
       }
     };

     const addFund = async () => {
       if (!newFund.value.code) {
         MessagePlugin.warning('请输入基金代码');
         return;
       }
       if (fundList.value.some(f => f.code === newFund.value.code)) {
         MessagePlugin.warning('该基金已存在');
         return;
       }
       try {
         const fundData = {
           ...newFund.value,
           notice: '1' // 默认开启所有通知
         };
         await storageApi.set(newFund.value.code, fundData);
         fundList.value.push({ ...fundData, code: newFund.value.code });
         fundList.value.sort((a, b) => a.code.localeCompare(b.code));
         newFund.value = { code: '', name: '', buy: 0, adding: 0, sell: 0, fene: 0 };
         MessagePlugin.success('添加成功');
       } catch (error) {
         console.error('添加基金失败:', error);
         MessagePlugin.error('添加失败');
       }
     };

     const updateFund = async (fund: FundItem) => {
       try {
         const data = { ...fund };
         delete (data as any).code;
         await storageApi.set(fund.code, data);
       } catch (error) {
         MessagePlugin.error('更新失败');
       }
     };

     const deleteFund = async (code: string) => {
       try {
         await storageApi.remove(code);
         fundList.value = fundList.value.filter(f => f.code !== code);
         MessagePlugin.success('删除成功');
       } catch (error) {
         MessagePlugin.error('删除失败');
       }
     };

     /**
      * 更新通知设置
      */
     const updateNotice = async () => {
       if (!noticeType.value || selectedRowKeys.value.length === 0) {
         MessagePlugin.warning('请选择通知设置和基金');
         return;
       }

       try {
         const updates: Promise<void>[] = [];

         for (const code of selectedRowKeys.value) {
           const fund = fundList.value.find(f => f.code === code);
           if (fund) {
             fund.notice = noticeType.value;
             updates.push(updateFund(fund));
           }
         }

         await Promise.all(updates);

         const updatedCount = selectedRowKeys.value.length;

         // 清空选择和通知类型
         selectedRowKeys.value = [];
         noticeType.value = '';

         MessagePlugin.success(`已为 ${updatedCount} 只基金更新通知设置`);
       } catch (error) {
         console.error('更新通知设置失败:', error);
         MessagePlugin.error('更新通知设置失败');
       }
     };

     const calculateProfit = (fund: FundItem): number => {
       if (!fund.fene || !fund.now) return 0;
       const fene = typeof fund.fene === 'string' ? parseFloat(fund.fene) : fund.fene;
       const now = typeof fund.now === 'string' ? parseFloat(fund.now) : fund.now;
       const buy = typeof fund.buy === 'string' ? parseFloat(fund.buy) : fund.buy;
       if (isNaN(fene) || isNaN(now) || isNaN(buy)) return 0;
       return fene * now - buy * fene;
     };

     const calculateHoldProfit = (fund: FundItem): number => {
       if (!fund.fene || !fund.jingzhi) return 0;
       const fene = typeof fund.fene === 'string' ? parseFloat(fund.fene) : fund.fene;
       const jingzhi = typeof fund.jingzhi === 'string' ? parseFloat(fund.jingzhi) : fund.jingzhi;
       const buy = typeof fund.buy === 'string' ? parseFloat(fund.buy) : fund.buy;
       if (isNaN(fene) || isNaN(jingzhi) || isNaN(buy)) return 0;
       return fene * jingzhi - buy * fene;
     };

     const totalProfit = computed(() => fundList.value.reduce((sum, fund) => sum + calculateProfit(fund), 0));
     const totalHoldProfit = computed(() => fundList.value.reduce((sum, fund) => sum + calculateHoldProfit(fund), 0));

     const formatPrice = (price?: number | string): string => {
       if (price == null) return '--';
       const numPrice = typeof price === 'string' ? parseFloat(price) : price;
       return !isNaN(numPrice) ? numPrice.toFixed(4) : '--';
     };
     const formatProfit = (profit: number): string => {
       const numProfit = typeof profit === 'string' ? parseFloat(profit as string) : profit;
       return !isNaN(numProfit) ? numProfit.toFixed(2) : '--';
     };
     const getProfitClass = (profit: number): string => profit > 0 ? 'profit-positive' : profit < 0 ? 'profit-negative' : '';
     const getPriceClass = (fund: FundItem): string => {
       if (!fund.now) return '';
       const now = typeof fund.now === 'string' ? parseFloat(fund.now) : fund.now;
       const sell = typeof fund.sell === 'string' ? parseFloat(fund.sell) : fund.sell;
       const adding = typeof fund.adding === 'string' ? parseFloat(fund.adding) : fund.adding;

       if (isNaN(now)) return '';
       if (!isNaN(sell) && now >= sell) return 'price-danger';
       if (!isNaN(adding) && adding >= now) return 'price-success';
       return '';
     };

     /**
      * 刷新基金数据 - 从后端服务获取最新的实时数据
      */
     const refreshData = async () => {
       if (fundList.value.length === 0) {
         await loadFunds();
         return;
       }

       loading.value = true;
       try {
         const updates: FundItem[] = [];

         // 并行获取所有基金的最新数据
         await Promise.all(
           fundList.value.map(async (fund) => {
             try {
               const estimate = await fetchFundEstimate(fund.code);
               const updatedFund = {
                 ...fund,
                 name: estimate.name || fund.name,
                 now: estimate.estimate || estimate.price || fund.now,
                 jingzhi: estimate.previous_value || fund.jingzhi,
                 jingzhi_time: estimate.updated_at || fund.jingzhi_time
               };
               updates.push(updatedFund);

               // 更新存储
               const data = { ...updatedFund };
               delete (data as any).code;
               await storageApi.set(fund.code, data);
             } catch (error) {
               console.error(`刷新基金 ${fund.code} 数据失败:`, error);
               // 如果获取失败，保持原数据
               updates.push(fund);
             }
           })
         );

         // 更新列表
         fundList.value = updates;
         MessagePlugin.success(`已刷新 ${updates.length} 只基金的数据`);
       } catch (error) {
         console.error('刷新数据失败:', error);
         MessagePlugin.error('刷新数据失败');
       } finally {
         loading.value = false;
       }
     };

     const openHelp = () => window.open('https://www.pescms.com/d/v/32/84.html', '_blank');
     const showDonation = () => donationVisible.value = true;
     const openBackup = () => MessagePlugin.info('云备份功能待集成');
     const viewFund = (code: string) => window.open(`https://fund.eastmoney.com/${code}.html`, '_blank');
     const onSelectChange = (selectedKeys: string[]) => selectedRowKeys.value = selectedKeys;

     onMounted(() => {
       loadFunds();

       // 检查URL参数，如果有showDonation=true则自动显示捐赠对话框
       const urlParams = new URLSearchParams(window.location.search);
       if (urlParams.get('showDonation') === 'true') {
         donationVisible.value = true;
       }
     });
     </script>

     <style scoped>
     .fund-list-container {
       width: 100%;
       min-width: 1200px;
       max-width: 1800px;
       margin: 0 auto;
       padding: 24px;
     }
     .header-card { margin-bottom: 16px; }
     .header-title h1 { font-size: 24px; font-weight: 600; margin: 0 0 4px 0; color: #0f172a; }
     .header-title small { font-size: 14px; color: #64748b; }
     .notification-settings { display: flex; justify-content: space-between; align-items: center; padding: 16px; }
     .notice-legend { display: flex; gap: 16px; font-size: 13px; color: #64748b; }
     .notice-legend span { display: flex; align-items: center; gap: 4px; }
     .fund-name-cell { display: flex; align-items: center; gap: 8px; }
     .notice-icon { color: #f59e0b; font-size: 16px; }
     .add-fund-section { padding: 16px; border-top: 1px solid #e5e7eb; background: #f9fafb; }
     .fund-code-input { position: relative; }
     .fund-name-preview {
       position: absolute;
       top: 100%;
       left: 0;
       right: 0;
       background: #fff;
       border: 1px solid #e5e7eb;
       border-top: none;
       padding: 8px 12px;
       font-size: 12px;
       color: #64748b;
       border-radius: 0 0 6px 6px;
       box-shadow: 0 2px 4px rgba(0,0,0,0.1);
       z-index: 10;
     }
     .summary-section { padding: 16px; border-top: 1px solid #e5e7eb; background: #fafafa; }
     .summary-item { display: flex; align-items: center; gap: 8px; }
     .summary-label { font-weight: 500; color: #475569; }
     .summary-value { font-size: 18px; font-weight: 600; }
     .profit-positive { color: #16a34a; font-weight: 500; }
     .profit-negative { color: #dc2626; font-weight: 500; }
     .price-danger { color: #dc2626; }
     .price-success { color: #16a34a; }
     .text-gray { color: #94a3b8; font-size: 12px; }
     .text-center { text-align: center; }
     .mt-4 { margin-top: 16px; }
     </style>