/* Run with page.evaluate on a report. Does not open a system print dialog. */
(() => {
  const check=(ok,label)=>{if(!ok)throw new Error(label);};
  const tv=document.querySelector('.dos-workstation .terminal-tv');
  check(!!tv,'One directory workstation exists');
  check([...document.querySelectorAll('.terminal-tv')].filter(e=>!e.hidden).length===1,'Only one TV is displayed');
  const file=tv.querySelector('.dos-file');check(!!file,'Directory contains a console file');file.click();
  check(!tv.classList.contains('directory-open'),'Opening a file starts its console');
  [...tv.querySelectorAll('.terminal-controls button')].find(b=>b.textContent==='Print').click();
  const receipt=tv.querySelector('.thermal-receipt');check(!receipt.hidden,'Print feeds receipt paper');
  check(receipt.querySelector('pre').textContent===tv.terminal.lines.join('\n'),'Receipt contains every transcript line');
  [...receipt.querySelectorAll('button')].find(b=>b.textContent==='Tear off').click();check(receipt.hidden,'Tear off dismisses paper');
  return {passed:7};
})();
