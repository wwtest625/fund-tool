#!/usr/bin/env python3
"""
测试修复后的AkShare美股指数获取功能
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from main import _fetch_index_via_akshare, _safe_float

def test_fixed_akshare():
    """测试修复后的AkShare函数"""
    print("测试修复后的AkShare美股指数获取功能")
    print("=" * 50)
    
    # 测试纳斯达克
    print("\n测试纳斯达克指数 (.IXIC):")
    nasdaq_data = _fetch_index_via_akshare(".IXIC")
    if nasdaq_data:
        print("✅ 成功获取纳斯达克数据:")
        for key, value in nasdaq_data.items():
            print(f"  {key}: {value}")
    else:
        print("❌ 获取纳斯达克数据失败")
    
    # 测试标普500
    print("\n测试标普500指数 (.INX):")
    sp500_data = _fetch_index_via_akshare(".INX")
    if sp500_data:
        print("✅ 成功获取标普500数据:")
        for key, value in sp500_data.items():
            print(f"  {key}: {value}")
    else:
        print("❌ 获取标普500数据失败")
    
    print("\n" + "=" * 50)
    print("测试完成")

if __name__ == "__main__":
    test_fixed_akshare()
