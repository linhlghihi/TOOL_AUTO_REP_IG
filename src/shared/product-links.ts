export function normalizeProductLinks(values:string[]):string[]{
 if(values.length>6)throw new Error('Nhập tối đa 6 link sản phẩm mỗi lần.');
 return [...new Set(values.map(value=>{
  let u:URL;try{u=new URL(value.trim());}catch{throw new Error('Link sản phẩm không hợp lệ: '+value.slice(0,100));}
  if(u.protocol!=='https:'||u.username||u.password||u.port||/\/(cart|checkout|account|login|logout|admin)(\/|$)/i.test(u.pathname))throw new Error('Chỉ dùng link sản phẩm HTTPS công khai, không dùng link giỏ hàng/đăng nhập.');
  u.hash='';return u.href;
 }))];
}
