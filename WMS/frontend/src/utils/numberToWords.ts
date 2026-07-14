export function convertNumberToVietnameseWords(num: number): string {
  if (num === 0) return "Không đồng chẵn";
  
  const units = ["", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  const places = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];
  
  function readThreeDigits(n: number, isFirst: boolean): string {
    const hundreds = Math.floor(n / 100);
    const tens = Math.floor((n % 100) / 10);
    const ones = n % 10;
    let res = "";
    
    if (hundreds > 0) {
      res += units[hundreds] + " trăm ";
    } else if (!isFirst) {
      res += "không trăm ";
    }
    
    if (tens > 0) {
      if (tens === 1) {
        res += "mười ";
      } else {
        res += units[tens] + " mươi ";
      }
    } else if (ones > 0 && (hundreds > 0 || !isFirst)) {
      res += "lẻ ";
    }
    
    if (ones > 0) {
      if (ones === 1 && tens > 1) {
        res += "mốt";
      } else if (ones === 5 && tens > 0) {
        res += "lăm";
      } else {
        res += units[ones];
      }
    }
    
    return res.trim();
  }
  
  let str = "";
  let temp = Math.abs(num);
  
  const groups: number[] = [];
  while (temp > 0) {
    groups.push(temp % 1000);
    temp = Math.floor(temp / 1000);
  }
  
  for (let i = groups.length - 1; i >= 0; i--) {
    const val = groups[i];
    if (val === 0) continue; // Skip 000 group
    
    const isFirst = i === groups.length - 1;
    const groupStr = readThreeDigits(val, isFirst);
    
    if (groupStr) {
      str += groupStr + " " + places[i] + " ";
    }
  }
  
  str = str.trim();
  if (num < 0) {
    str = "âm " + str;
  }
  
  str = str.charAt(0).toUpperCase() + str.slice(1) + " đồng chẵn";
  str = str.replace(/\s+/g, ' ');
  return str;
}
