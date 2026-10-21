export const LOCAL_SERVER='http://127.0.0.1:43127';
export function serverUrl(value:unknown):string {
 if(typeof value!=='string')throw new Error('Nhập địa chỉ server.');
 let url:URL;try{url=new URL(value.trim());}catch{throw new Error('Địa chỉ server không hợp lệ.');}
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||
    (url.protocol!=='https:'&&url.origin!==LOCAL_SERVER))throw new Error('Dùng URL HTTPS hoặc http://127.0.0.1:43127, không kèm đường dẫn.');
 return url.origin;
}
