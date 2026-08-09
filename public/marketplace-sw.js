self.addEventListener('push',event=>{
  let data={};try{data=event.data?.json?.()||{}}catch{data={body:event.data?.text?.()||'You have a new ON CALL update.'}}
  const title=data.title||'ON CALL';
  const options={body:data.body||'Open ON CALL for details.',icon:'/favicon.svg',badge:'/favicon.svg',tag:data.notification_ref?`oc-${data.notification_ref}`:'on-call-update',renotify:true,requireInteraction:data.type==='provider_offer'||data.type==='job_offer',data:{url:data.url||'/'}};
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||'/',self.location.origin).href;
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    const existing=list.find(client=>client.url.startsWith(self.location.origin));
    if(existing){existing.focus();existing.navigate(target);return existing}
    return clients.openWindow(target);
  }));
});
