// Relevant to entity_geometry_info.json
struct EntityGeometryInfo
{
    public EntityType entityType;
    public string entityId;
    public double[] centerUv;
    public double[] centerPoint;
    public double[] centerNormal;
    public double area;
    public double minRadius;
    public double minPosRadius;
    public double minNegRadius;
    public EdgeCurveChain[] edgeCurveChains;
}

struct EdgeCurveChain
{
    public EdgeType edgeType;
    public EdgeCurve[] edgeCurves;
}

struct EdgeCurve
{
    public double[] startPoint;
    public double[] midPoint;
    public double[] endPoint;
    public double[] startPointNormal;
}

enum EntityType
{
    ENTITY_TYPE_PLANE,
    ENTITY_TYPE_CYLINDER,
    ENTITY_TYPE_ROTATIONAL,
    ENTITY_TYPE_NURBS,
}

enum EdgeType
{
    EDGE_TYPE_OUTER,
    EDGE_TYPE_INNER,
}

// Relevant to adjacency_graph_edge_metadata.json
enum GraphEdgeType
{
    CONCAVE,
    CONVEX,
    TANGENTIAL,
}