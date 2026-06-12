/* App — scene state machine: city -> per-building scene (each building has its own page). */
const { useState: useStateApp } = React;

function App() {
  const [scene, setScene] = useStateApp('city');
  const [building, setBuilding] = useStateApp(null);

  const enterBuilding = (b) => { setBuilding(b); setScene(b.id); };
  const reveal = () => setScene('prisma');
  const toCity = () => { setScene('city'); setBuilding(null); };

  let view = null;
  if      (scene === 'city')         view = <CityHero key="city" onEnterBuilding={enterBuilding} />;
  else if (scene === 'helix')        view = <HelixScene key="helix" building={building} onBack={toCity} />;
  else if (scene === 'meridian')     view = <MeridianScene key="meridian" building={building} onBack={toCity} />;
  else if (scene === 'apex')         view = <ApexScene key="apex" building={building} onBack={toCity} />;
  else if (scene === 'cinder')       view = <Interior key="cinder" building={building} onReveal={reveal} onBack={toCity} />;
  else if (scene === 'construction') view = <ConstructionScene key="construction" building={building} onBack={toCity} />;
  else if (scene === 'middlepark')   view = <MiddleParkScene key="middlepark" building={building} onBack={toCity} />;
  else if (scene === 'prisma')       view = <Prisma key="prisma" onBack={toCity} />;

  return (
    <>
      <div className="fixed inset-0 bg-black" key={scene}>{view}</div>
      <TweaksWidget />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);