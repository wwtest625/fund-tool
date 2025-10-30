#!/usr/bin/env python3
"""
AkShare 美股指数测试脚本
用于诊断纳斯达克和标普500指数获取问题
"""

import akshare as ak
import pandas as pd
import traceback
from datetime import datetime

def test_akshare_version():
    """测试AkShare版本"""
    print(f"AkShare 版本: {ak.__version__}")
    print(f"Pandas 版本: {pd.__version__}")
    print("-" * 50)

def test_us_stock_index(symbol: str, name: str):
    """测试美股指数获取"""
    print(f"\n测试 {name} ({symbol}):")
    try:
        # 使用AkShare的美股指数接口
        df = ak.index_us_stock_sina(symbol=symbol)
        
        if df is None:
            print(f"❌ 返回 None")
            return False
            
        if df.empty:
            print(f"❌ 返回空DataFrame")
            return False
            
        print(f"✅ 成功获取数据")
        print(f"数据行数: {len(df)}")
        print(f"列名: {list(df.columns)}")
        
        # 显示最新数据
        if len(df) > 0:
            latest = df.iloc[-1]
            print(f"最新数据:")
            for col in df.columns:
                print(f"  {col}: {latest[col]}")
                
        # 显示前几行数据
        print(f"\n前3行数据:")
        print(df.head(3))
        
        return True
        
    except Exception as e:
        print(f"❌ 异常: {type(e).__name__}: {e}")
        print(f"详细错误:")
        traceback.print_exc()
        return False

def test_alternative_methods():
    """测试其他可能的方法"""
    print(f"\n测试其他AkShare接口:")
    
    # 测试其他可能的美股接口
    alternative_methods = [
        ("stock_us_spot_sina", "美股实时行情"),
        ("index_us_stock_sina", "美股指数行情"),
    ]
    
    for method_name, description in alternative_methods:
        try:
            if hasattr(ak, method_name):
                print(f"\n尝试 {method_name} ({description}):")
                method = getattr(ak, method_name)
                
                # 尝试不同的参数
                test_symbols = [".IXIC", "IXIC", "^IXIC", ".INX", "INX", "^GSPC"]
                
                for symbol in test_symbols:
                    try:
                        print(f"  测试符号: {symbol}")
                        result = method(symbol=symbol)
                        if result is not None and not result.empty:
                            print(f"    ✅ 成功: {len(result)} 行数据")
                            print(f"    列名: {list(result.columns)}")
                            break
                        else:
                            print(f"    ❌ 空数据")
                    except Exception as e:
                        print(f"    ❌ 错误: {e}")
                        
            else:
                print(f"❌ 方法 {method_name} 不存在")
                
        except Exception as e:
            print(f"❌ 测试 {method_name} 时出错: {e}")

def test_network_connectivity():
    """测试网络连接"""
    print(f"\n测试网络连接:")
    
    import requests
    
    test_urls = [
        "https://stock.finance.sina.com.cn/usstock/quotes/.IXIC.html",
        "https://finance.sina.com.cn",
        "https://hq.sinajs.cn",
    ]
    
    for url in test_urls:
        try:
            response = requests.get(url, timeout=10, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
            print(f"✅ {url}: {response.status_code}")
        except Exception as e:
            print(f"❌ {url}: {e}")

def main():
    """主函数"""
    print("AkShare 美股指数诊断工具")
    print("=" * 50)
    
    # 测试版本
    test_akshare_version()
    
    # 测试网络连接
    test_network_connectivity()
    
    # 测试纳斯达克指数
    nasdaq_success = test_us_stock_index(".IXIC", "纳斯达克指数")
    
    # 测试标普500指数  
    sp500_success = test_us_stock_index(".INX", "标普500指数")
    
    # 如果都失败，测试其他方法
    if not nasdaq_success and not sp500_success:
        test_alternative_methods()
    
    print(f"\n" + "=" * 50)
    print(f"测试完成 - {datetime.now()}")
    
    # 总结
    print(f"\n总结:")
    print(f"纳斯达克指数: {'✅ 成功' if nasdaq_success else '❌ 失败'}")
    print(f"标普500指数: {'✅ 成功' if sp500_success else '❌ 失败'}")

if __name__ == "__main__":
    main()
