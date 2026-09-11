// Price observations are separate from eatIQ's editable recipe quantities.
window.EatIQFinanceReferences = (() => {
  const grocerySource={label:'Procon-SP / Dieese · julho de 2026 · tabela da página 13',date:'2026-07-31',url:'https://www.procon.sp.gov.br/wp-content/uploads/2026/08/CB-julho-2026-com-comparativo-anual.pdf'};
  const restaurantSource={label:'ABBT, publicada pela Alelo · São Paulo · setembro de 2025',date:'2025-09',url:'https://www.pesquisaprecomedio.com.br/preco-medio-refeicao/sp/sao-paulo'};
  const pantry=[
    {name:'Arroz cru',pack:'5 kg',price:19.63,units:5000,amount:75,unit:'g'},
    {name:'Feijão carioquinha seco',pack:'1 kg',price:8.96,units:1000,amount:50,unit:'g'},
    {name:'Batata crua',pack:'1 kg',price:8.20,units:1000,amount:150,unit:'g'},
    {name:'Cebola',pack:'1 kg',price:7.89,units:1000,amount:30,unit:'g'},
    {name:'Alho',pack:'1 kg',price:31.60,units:1000,amount:5,unit:'g'},
    {name:'Óleo de soja',pack:'900 ml',price:7.37,units:900,amount:10,unit:'ml'}
  ];
  const proteins={beef:{name:'Carne de primeira crua',pack:'1 kg',price:48.54,units:1000,amount:200,unit:'g'},eggs:{name:'Ovos brancos',pack:'12 unidades',price:10.74,units:12,amount:2,unit:'un.'}};
  function recipe(id){
    if(!proteins[id])return null;
    const items=[...pantry,proteins[id]].map(x=>({...x,cost:x.price/x.units*x.amount}));
    return {id,label:id==='beef'?'Arroz, feijão, carne e batata':'Arroz, feijão, ovos e batata',items,total:items.reduce((s,x)=>s+x.cost,0),source:grocerySource};
  }
  const restaurants={commercial:{label:'Comercial / prato feito',price:44.16},executive:{label:'Executivo',price:58.84},selfservice:{label:'Autosserviço',price:61.44},alacarte:{label:'À la carte',price:103.66}};
  return {recipe,restaurants,grocerySource,restaurantSource};
})();
